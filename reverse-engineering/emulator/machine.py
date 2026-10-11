"""A whole-process machine: `LEGORacers.exe` and `GolDP.dll` booted the way Windows would, with the operating system and DirectX stubbed.

The machine adds to `Emulator`: a thread block (`fs`), a heap, a file system served from the game folder, the Win32 and C runtime
imports (`win32_stubs.py`, `crt_stubs.py`), fake DirectX objects (`com_stubs.py`) and a scripted clock. It runs real game code
from its entry point and stops at addresses chosen by the caller.
"""

import os
import struct
import sys

from unicorn import UC_HOOK_BLOCK, UC_HOOK_CODE, UC_HOOK_MEM_READ_UNMAPPED, UC_HOOK_MEM_WRITE_UNMAPPED, UC_HOOK_MEM_FETCH_UNMAPPED, UcError
from unicorn.x86_const import (
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_EAX,
    UC_X86_REG_EBP,
    UC_X86_REG_EBX,
    UC_X86_REG_ECX,
    UC_X86_REG_EDI,
    UC_X86_REG_EDX,
    UC_X86_REG_EIP,
    UC_X86_REG_ES,
    UC_X86_REG_ESI,
    UC_X86_REG_ESP,
    UC_X86_REG_FPCW,
    UC_X86_REG_FPSW,
    UC_X86_REG_FPTAG,
    UC_X86_REG_FS,
    UC_X86_REG_GDTR,
    UC_X86_REG_SS,
)

from emulator import (
    SCRATCH_BASE,
    SENTINEL_ADDRESS,
    STACK_BASE,
    STACK_SIZE,
    STUB_BASE,
    Emulator,
    UnstubbedImportError,
)
from pe_image import PAGE_SIZE, align_up
from stubs import StubContext

HEAP_BASE = 0x50000000
HEAP_SIZE = 0x20000000
GDT_BASE = 0x7D000000
THREAD_BLOCK_BASE = 0x7D100000
DATA_PAGE = STUB_BASE + 0xF000
FPU_CONTROL_SINGLE = 0x007F
FPU_CONTROL_DOUBLE = 0x027F

DATA_IMPORT_SIZES = {"_acmdln": 4, "_adjust_fdiv": 4}


class ProcessExit(Exception):
    pass


class MachineStop(Exception):
    pass


class GameMachine(Emulator):
    def __init__(self, game_files_directory: str, options: dict):
        self.options = options
        self.game_files_directory = game_files_directory
        self.is_trace_enabled = bool(os.environ.get("GOLDEN_TRACE_STUBS"))
        self.data_cursor = DATA_PAGE
        self.data_cells = {}
        self.heap_cursor = HEAP_BASE
        self.heap_sizes = {}
        self.operating_system = None
        self.stop_requests = []
        self.stop_reason = None
        self.address_hooks = {}
        self.skip_hook_address = None
        self.last_stub_calls = []
        super().__init__(game_files_directory)
        self.uc.mem_map(HEAP_BASE, HEAP_SIZE)
        self.setup_thread_block()
        self.uc.hook_add(UC_HOOK_MEM_READ_UNMAPPED | UC_HOOK_MEM_WRITE_UNMAPPED | UC_HOOK_MEM_FETCH_UNMAPPED, self.on_unmapped)
        from crt_stubs import register_crt_stubs
        from win32_stubs import Win32
        from com_stubs import register_com_stubs

        register_crt_stubs(self)
        self.operating_system = Win32(self)
        self.operating_system.register(self)
        register_com_stubs(self)
        self.recent_blocks = []
        if os.environ.get("GOLDEN_TRACE_BLOCKS"):
            self.uc.hook_add(UC_HOOK_BLOCK, self.on_block)
        self.write_fpu_control(FPU_CONTROL_DOUBLE)

    def make_stub_context(self) -> StubContext:
        return StubContext(self.uc, self)

    def resolve_import(self, entry) -> int:
        if entry.function_name in DATA_IMPORT_SIZES:
            cell = self.allocate_data(DATA_IMPORT_SIZES[entry.function_name])
            self.data_cells[entry.function_name] = cell
            return cell
        return super().resolve_import(entry)

    def allocate_data(self, size: int) -> int:
        address = self.data_cursor
        self.data_cursor += align_up(size, 16)
        return address

    def setup_thread_block(self) -> None:
        self.uc.mem_map(GDT_BASE, PAGE_SIZE)
        self.uc.mem_map(THREAD_BLOCK_BASE, 0x10000)
        entries = [
            0,
            self.descriptor(0, 0xFFFFF, 0x9B, 0xC),
            self.descriptor(0, 0xFFFFF, 0x93, 0xC),
            self.descriptor(THREAD_BLOCK_BASE, 0xFFF, 0x93, 0x4),
        ]
        self.uc.mem_write(GDT_BASE, b"".join(struct.pack("<Q", entry) for entry in entries))
        self.uc.reg_write(UC_X86_REG_GDTR, (0, GDT_BASE, len(entries) * 8 - 1, 0))
        self.uc.reg_write(UC_X86_REG_CS, 1 << 3)
        self.uc.reg_write(UC_X86_REG_SS, 2 << 3)
        self.uc.reg_write(UC_X86_REG_DS, 2 << 3)
        self.uc.reg_write(UC_X86_REG_ES, 2 << 3)
        self.uc.reg_write(UC_X86_REG_FS, 3 << 3)
        stack_top = STACK_BASE + STACK_SIZE - 0x1000
        self.uc.mem_write(THREAD_BLOCK_BASE, struct.pack("<I", 0xFFFFFFFF))
        self.uc.mem_write(THREAD_BLOCK_BASE + 4, struct.pack("<II", stack_top, STACK_BASE))
        self.uc.mem_write(THREAD_BLOCK_BASE + 0x18, struct.pack("<I", THREAD_BLOCK_BASE))
        self.uc.mem_write(THREAD_BLOCK_BASE + 0x20, struct.pack("<II", 0x1000, 0x1004))

    @staticmethod
    def descriptor(base: int, limit: int, access: int, flags: int) -> int:
        return (
            (limit & 0xFFFF)
            | ((base & 0xFFFFFF) << 16)
            | (access << 40)
            | (((limit >> 16) & 0xF) << 48)
            | (flags << 52)
            | (((base >> 24) & 0xFF) << 56)
        )

    def on_block(self, uc, address, size, user_data):
        self.recent_blocks.append(address)
        if len(self.recent_blocks) > 64:
            del self.recent_blocks[:32]

    def on_unmapped(self, uc, access, address, size, value, user_data):
        eip = uc.reg_read(UC_X86_REG_EIP)
        self.unmapped_report = f"unmapped access {access} at {address:#x} size {size} from eip={eip:#x}"
        return False

    def write_fpu_control(self, control_word: int) -> None:
        self.uc.reg_write(UC_X86_REG_FPCW, control_word)

    def set_fpu_precision(self, precision: str) -> None:
        self.write_fpu_control(FPU_CONTROL_SINGLE if precision == "single" else FPU_CONTROL_DOUBLE)

    def allocate_heap(self, size: int, alignment: int = 16) -> int:
        address = (self.heap_cursor + alignment - 1) & ~(alignment - 1)
        self.heap_cursor = address + max(size, 1)
        if self.heap_cursor > HEAP_BASE + HEAP_SIZE:
            raise MemoryError("guest heap exhausted")
        self.heap_sizes[address] = size
        return address

    def read_bytes(self, address: int, size: int) -> bytes:
        return bytes(self.uc.mem_read(address, size))

    def write_bytes(self, address: int, data: bytes) -> None:
        self.uc.mem_write(address, data)

    def read_u32(self, address: int) -> int:
        return struct.unpack("<I", self.uc.mem_read(address, 4))[0]

    def write_u32(self, address: int, value: int) -> None:
        self.uc.mem_write(address, struct.pack("<I", value & 0xFFFFFFFF))

    def read_f32(self, address: int) -> float:
        return struct.unpack("<f", self.uc.mem_read(address, 4))[0]

    def read_c_string(self, address: int, limit: int = 4096) -> str:
        chunk = bytearray()
        while len(chunk) < limit:
            byte = self.uc.mem_read(address + len(chunk), 1)[0]
            if byte == 0:
                break
            chunk.append(byte)
        return chunk.decode("latin-1")

    def write_c_string(self, address: int, text: str) -> None:
        self.uc.mem_write(address, text.encode("latin-1") + b"\0")

    def new_c_string(self, text: str) -> int:
        address = self.allocate_heap(len(text) + 1, 4)
        self.write_c_string(address, text)
        return address

    # Running ------------------------------------------------------------------------------------------------------

    def add_address_hook(self, address: int, callback) -> None:
        if address in self.address_hooks:
            self.address_hooks[address].append(callback)
            return
        self.address_hooks[address] = [callback]
        self.uc.hook_add(UC_HOOK_CODE, self.on_address_hook, begin=address, end=address)

    def on_address_hook(self, uc, address, size, user_data):
        if address == self.skip_hook_address:
            self.skip_hook_address = None
            return
        for callback in self.address_hooks[address]:
            callback()

    def request_stop(self, reason: str) -> None:
        self.stop_reason = reason
        self.uc.emu_stop()

    def prepare_call(self, convention: str, arguments: list) -> int:
        stack_arguments = [argument & 0xFFFFFFFF for argument in arguments]
        if convention == "thiscall":
            self.uc.reg_write(UC_X86_REG_ECX, stack_arguments.pop(0))
        elif convention == "fastcall":
            self.uc.reg_write(UC_X86_REG_ECX, stack_arguments.pop(0))
            self.uc.reg_write(UC_X86_REG_EDX, stack_arguments.pop(0))
        esp = STACK_BASE + STACK_SIZE - 0x1000 - 4 * len(stack_arguments) - 4
        self.write_words(esp, [SENTINEL_ADDRESS] + stack_arguments)
        self.uc.reg_write(UC_X86_REG_ESP, esp)
        return esp

    def run(self, start: int) -> str:
        """Runs from `start` until the sentinel return, a requested stop, the process exit, or an error. Returns the reason."""
        self.pending_error = None
        self.stop_reason = None
        self.unmapped_report = None
        try:
            self.uc.emu_start(start, SENTINEL_ADDRESS, count=0)
        except UcError as error:
            raise RuntimeError(self.describe_failure(error)) from error
        if self.pending_error is not None:
            raise RuntimeError(self.describe_failure(self.pending_error)) from self.pending_error
        if self.stop_reason is not None:
            return self.stop_reason
        if self.uc.reg_read(UC_X86_REG_EIP) == SENTINEL_ADDRESS:
            return "returned"
        raise RuntimeError(self.describe_failure(RuntimeError("emulation stopped")))

    def resume(self) -> str:
        eip = self.uc.reg_read(UC_X86_REG_EIP)
        self.skip_hook_address = eip if eip in self.address_hooks else None
        return self.run(eip)

    def call_function(self, address: int, convention: str, arguments: list, result_float: bool = False):
        self.prepare_call(convention, arguments)
        reason = self.run(address)
        if reason != "returned":
            raise RuntimeError(f"call to {address:#x} ended with {reason}")
        return self.uc.reg_read(UC_X86_REG_EAX)

    def describe_failure(self, error) -> str:
        uc = self.uc
        eip = uc.reg_read(UC_X86_REG_EIP)
        lines = [
            f"{type(error).__name__}: {error}",
            getattr(self, "unmapped_report", None) or "",
            f"eip={eip:#x} esp={uc.reg_read(UC_X86_REG_ESP):#x} eax={uc.reg_read(UC_X86_REG_EAX):#x} ecx={uc.reg_read(UC_X86_REG_ECX):#x}"
            f" edx={uc.reg_read(UC_X86_REG_EDX):#x} ebx={uc.reg_read(UC_X86_REG_EBX):#x} esi={uc.reg_read(UC_X86_REG_ESI):#x}"
            f" edi={uc.reg_read(UC_X86_REG_EDI):#x} ebp={uc.reg_read(UC_X86_REG_EBP):#x}",
            "last stub calls: " + " | ".join(self.last_stub_calls[-12:]),
            "recent blocks: " + " ".join(f"{block:x}" for block in self.recent_blocks[-24:]),
            "stack: " + " ".join(self.read_stack_words(24)),
        ]
        return "\n".join(line for line in lines if line)

    def read_stack_words(self, count: int) -> list:
        esp = self.uc.reg_read(UC_X86_REG_ESP)
        try:
            return [f"{word:08x}" for word in self.read_words(esp, count)]
        except UcError:
            return []

    def persistent_cell(self, name: str, size: int = 64) -> int:
        cells = self.__dict__.setdefault("persistent_cells", {})
        if name not in cells:
            cells[name] = self.allocate_heap(size, 16)
        return cells[name]

    def persistent_string(self, name: str, text: str) -> int:
        cells = self.__dict__.setdefault("persistent_cells", {})
        if name not in cells:
            cells[name] = self.new_c_string(text)
        return cells[name]

    def on_stub_executed(self, uc, address, size, user_data):
        try:
            self.record_and_dispatch(uc, address, size, user_data)
        except Exception as error:  # noqa: BLE001 - a failing stub must stop the run with its cause
            self.pending_error = error
            uc.emu_stop()

    def record_and_dispatch(self, uc, address, size, user_data):
        name = self.stub_names.get(address)
        if name is not None:
            esp = uc.reg_read(UC_X86_REG_ESP)
            words = struct.unpack("<5I", uc.mem_read(esp, 20))
            record = f"{name}({','.join(f'{word:x}' for word in words[1:])}) from {words[0]:#x}"
            self.last_stub_calls.append(record)
            if len(self.last_stub_calls) > 64:
                del self.last_stub_calls[:32]
            if self.is_trace_enabled:
                print(record, file=sys.stderr)
        super().on_stub_executed(uc, address, size, user_data)

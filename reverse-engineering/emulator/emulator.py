"""Runs functions of LEGORacers.exe and GolDP.dll in Unicorn (x86, 32-bit) with trapped imports."""

import inspect
import os
import struct

from unicorn import UC_ARCH_X86, UC_HOOK_CODE, UC_MODE_32, Uc, UcError
from unicorn.x86_const import (
    UC_X86_REG_EAX,
    UC_X86_REG_ECX,
    UC_X86_REG_EDX,
    UC_X86_REG_EIP,
    UC_X86_REG_ESP,
    UC_X86_REG_FPCW,
    UC_X86_REG_FPSW,
    UC_X86_REG_FPTAG,
)

from pe_image import PAGE_SIZE, align_up, load_pe_image
from stubs import STUB_HANDLERS, StubContext, read_st0

IMAGE_FILE_NAMES = ("LEGORacers.exe", "GolDP.dll")
STUB_BASE = 0x7E000000
STUB_SLOT_SIZE = 16
SENTINEL_ADDRESS = STUB_BASE + 0xFF00
PUSH_SNIPPET = STUB_BASE + 0xFE00
REPLACE_SNIPPET = STUB_BASE + 0xFE10
POP_SNIPPET = STUB_BASE + 0xFE20
FLOAT_RESULT_ADDRESS = STUB_BASE + 0xFD00
SCRATCH_BASE = 0x20000000
SCRATCH_SIZE = 0x4000000
STACK_BASE = 0x30000000
STACK_SIZE = 0x1000000
PRECISION_CONTROL_WORDS = {"single": 0x007F, "double": 0x027F}
MAXIMUM_INSTRUCTIONS = 5_000_000


class UnstubbedImportError(RuntimeError):
    pass


class Emulator:
    def __init__(self, game_files_directory: str):
        self.uc = Uc(UC_ARCH_X86, UC_MODE_32)
        self.pending_error = None
        self.stub_names = {}
        self.scratch_cursor = SCRATCH_BASE
        self.uc.mem_map(SCRATCH_BASE, SCRATCH_SIZE)
        self.uc.mem_map(STACK_BASE, STACK_SIZE)
        self.uc.mem_map(STUB_BASE, 0x10000)
        load_result = b"\xdd\x05" + struct.pack("<I", FLOAT_RESULT_ADDRESS)
        self.uc.mem_write(PUSH_SNIPPET, load_result + b"\xc3")
        self.uc.mem_write(REPLACE_SNIPPET, b"\xdd\xd8" + load_result + b"\xc3")
        self.uc.mem_write(POP_SNIPPET, b"\xdd\xd8\xc3")
        self.uc.mem_write(SENTINEL_ADDRESS, b"\xf4")
        self.handlers = dict(STUB_HANDLERS)
        self.pending_guest_calls = []
        self.continuation_address = self.new_stub("continuation")
        self.images = [self.load_image(os.path.join(game_files_directory, name)) for name in IMAGE_FILE_NAMES]
        self.uc.hook_add(UC_HOOK_CODE, self.on_stub_executed, begin=STUB_BASE, end=STUB_BASE + 0xFC00)

    def load_image(self, path: str):
        image = load_pe_image(path)
        self.uc.mem_map(image.image_base, align_up(image.image_size))
        for section in image.sections:
            self.uc.mem_write(image.image_base + section.virtual_address, section.raw_data)
        for entry in image.imports:
            self.uc.mem_write(entry.table_entry_address, struct.pack("<I", self.resolve_import(entry)))
        return image

    def resolve_import(self, entry) -> int:
        return self.new_stub(f"{entry.dll_name.lower()}!{entry.function_name}")

    def new_stub(self, name: str) -> int:
        stub_address = STUB_BASE + len(self.stub_names) * STUB_SLOT_SIZE
        if stub_address >= STUB_BASE + 0xFC00:
            raise MemoryError("stub table exhausted")
        self.stub_names[stub_address] = name
        return stub_address

    def make_stub_context(self) -> StubContext:
        return StubContext(self.uc)

    def advance_guest_call(self, result):
        """Steps the innermost generator stub: it yields (address, arguments) to call guest code, and returns the stub's result."""
        uc = self.uc
        pending = self.pending_guest_calls[-1]
        generator, esp, return_address, cleanup = pending
        try:
            address, arguments = generator.send(result)
        except StopIteration as finished:
            self.pending_guest_calls.pop()
            uc.reg_write(UC_X86_REG_EAX, (finished.value or 0) & 0xFFFFFFFF)
            uc.reg_write(UC_X86_REG_ESP, esp + 4 + cleanup)
            uc.reg_write(UC_X86_REG_EIP, return_address)
            return
        frame = esp - 4 * len(arguments) - 4
        uc.mem_write(frame, struct.pack(f"<{len(arguments) + 1}I", self.continuation_address, *[a & 0xFFFFFFFF for a in arguments]))
        uc.reg_write(UC_X86_REG_ESP, frame)
        uc.reg_write(UC_X86_REG_EIP, address)

    def on_stub_executed(self, uc, address, size, user_data):
        if address == self.continuation_address:
            self.advance_guest_call(uc.reg_read(UC_X86_REG_EAX))
            return
        name = self.stub_names.get(address)
        if name is None:
            return
        handler = self.handlers.get(name.split("!", 1)[1])
        if handler is None:
            self.pending_error = UnstubbedImportError(f"unstubbed import {name}")
            uc.emu_stop()
            return
        esp = uc.reg_read(UC_X86_REG_ESP)
        return_address = struct.unpack("<I", uc.mem_read(esp, 4))[0]

        def read_argument(index: int) -> int:
            return struct.unpack("<I", uc.mem_read(esp + 4 + index * 4, 4))[0]

        result = handler(self.make_stub_context(), read_argument)
        if inspect.isgenerator(result):
            self.pending_guest_calls.append([result, esp, return_address, getattr(handler, "callee_cleanup_bytes", 0)])
            self.advance_guest_call(None)
            return
        new_esp = esp + 4 + result.callee_cleanup_bytes
        uc.reg_write(UC_X86_REG_EAX, result.integer & 0xFFFFFFFF)
        uc.reg_write(UC_X86_REG_EDX, result.high_integer & 0xFFFFFFFF)
        uc.reg_write(UC_X86_REG_ESP, new_esp - 4)
        uc.mem_write(new_esp - 4, struct.pack("<I", return_address))
        if result.floating is not None:
            uc.mem_write(FLOAT_RESULT_ADDRESS, struct.pack("<d", result.floating))
        snippet = {(False, False): None, (True, False): POP_SNIPPET, (False, True): PUSH_SNIPPET, (True, True): REPLACE_SNIPPET}[
            (result.pops_input, result.floating is not None)
        ]
        if snippet is None:
            uc.reg_write(UC_X86_REG_ESP, new_esp)
            uc.reg_write(UC_X86_REG_EIP, return_address)
        else:
            uc.reg_write(UC_X86_REG_EIP, snippet)

    def allocate(self, size: int) -> int:
        address = self.scratch_cursor
        self.scratch_cursor += align_up(max(size, 16), 16)
        if self.scratch_cursor > SCRATCH_BASE + SCRATCH_SIZE:
            raise MemoryError("scratch heap exhausted")
        return address

    def write_words(self, address: int, words: list) -> None:
        self.uc.mem_write(address, struct.pack(f"<{len(words)}I", *words))

    def read_words(self, address: int, count: int) -> list:
        return list(struct.unpack(f"<{count}I", self.uc.mem_read(address, count * 4)))

    def reset_fpu(self, precision: str) -> None:
        self.uc.reg_write(UC_X86_REG_FPCW, PRECISION_CONTROL_WORDS[precision])
        self.uc.reg_write(UC_X86_REG_FPSW, 0)
        self.uc.reg_write(UC_X86_REG_FPTAG, 0xFFFF)

    def call(
        self, address: int, convention: str, arguments: list, precision: str, buffers: list, reads: list, patches: list = ()
    ) -> dict:
        self.scratch_cursor = SCRATCH_BASE
        for patch in patches:
            self.uc.mem_write(patch["address"], bytes(patch["bytes"]))
        buffer_addresses = {}
        for buffer in buffers:
            words = buffer.get("words")
            buffer_addresses[buffer["name"]] = self.allocate(len(words) * 4 if words is not None else buffer["size"])
        for buffer in buffers:
            if "words" not in buffer:
                self.uc.mem_write(buffer_addresses[buffer["name"]], bytes(buffer["size"]))
            else:
                resolved_words = [self.resolve_argument(word, buffer_addresses) for word in buffer["words"]]
                self.write_words(buffer_addresses[buffer["name"]], resolved_words)
        resolved = [self.resolve_argument(argument, buffer_addresses) for argument in arguments]
        stack_arguments = list(resolved)
        if convention == "thiscall":
            self.uc.reg_write(UC_X86_REG_ECX, stack_arguments.pop(0))
        elif convention == "fastcall":
            self.uc.reg_write(UC_X86_REG_ECX, stack_arguments.pop(0))
            self.uc.reg_write(UC_X86_REG_EDX, stack_arguments.pop(0))
        elif convention not in ("cdecl", "stdcall"):
            raise ValueError(f"unknown calling convention {convention}")
        esp = STACK_BASE + STACK_SIZE - 0x1000
        esp -= 4 * len(stack_arguments)
        self.write_words(esp, stack_arguments)
        esp -= 4
        self.write_words(esp, [SENTINEL_ADDRESS])
        self.uc.reg_write(UC_X86_REG_ESP, esp)
        self.reset_fpu(precision)
        self.pending_error = None
        try:
            self.uc.emu_start(address, SENTINEL_ADDRESS, count=MAXIMUM_INSTRUCTIONS)
        except UcError as error:
            raise RuntimeError(f"emulation failed at eip={self.uc.reg_read(UC_X86_REG_EIP):#x}: {error}") from error
        if self.pending_error is not None:
            raise self.pending_error
        if self.uc.reg_read(UC_X86_REG_EIP) != SENTINEL_ADDRESS:
            raise RuntimeError(f"function did not return (eip={self.uc.reg_read(UC_X86_REG_EIP):#x}); instruction limit?")
        return self.collect_result(buffer_addresses, reads, buffers)

    def resolve_argument(self, argument, buffer_addresses: dict) -> int:
        if isinstance(argument, dict):
            return buffer_addresses[argument["buffer"]] + argument.get("offset", 0)
        return argument & 0xFFFFFFFF

    def collect_result(self, buffer_addresses: dict, reads: list, buffers: list) -> dict:
        status = self.uc.reg_read(UC_X86_REG_FPSW)
        stack_top = (status >> 11) & 7
        mantissa, sign_exponent = read_st0(self.uc)
        result = {
            "eax": self.uc.reg_read(UC_X86_REG_EAX),
            "fpuStackDepth": (8 - stack_top) % 8,
            "st0": {"mantissa": f"{mantissa:016x}", "signExponent": f"{sign_exponent:04x}"},
            "buffers": {},
        }
        for buffer in buffers:
            if buffer.get("isRead", False):
                size = len(buffer["words"]) if "words" in buffer else buffer["size"] // 4
                result["buffers"][buffer["name"]] = self.read_words(buffer_addresses[buffer["name"]], size)
        for read in reads:
            result["buffers"][read["name"]] = self.read_words(read["address"], read["count"])
        return result

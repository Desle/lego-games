"""The C runtime imports of LEGORacers.exe (MSVCRT.dll), implemented on the host. All are cdecl (the caller cleans the stack)."""

import math
import os
import re
import struct

from stubs import StubResult

FORMAT_PATTERN = re.compile(r"%([-+ #0]*)(\d+|\*)?(?:\.(\d+|\*))?(?:hh|h|ll|l|L|I64)?([diuoxXcsfFeEgGp%])")


def format_c_string(machine, format_text: str, read_word) -> str:
    """printf for the conversions the game uses; `read_word()` returns the next 32-bit argument word."""
    output = []
    position = 0
    for match in FORMAT_PATTERN.finditer(format_text):
        output.append(format_text[position : match.start()])
        position = match.end()
        flags, width, precision, conversion = match.groups()
        if conversion == "%":
            output.append("%")
            continue
        if width == "*":
            width = str(struct.unpack("<i", struct.pack("<I", read_word()))[0])
        if precision == "*":
            precision = str(struct.unpack("<i", struct.pack("<I", read_word()))[0])
        spec = "%" + flags + (width or "") + ("." + precision if precision is not None else "")
        if conversion in "di":
            value = struct.unpack("<i", struct.pack("<I", read_word()))[0]
            output.append((spec + "d") % value)
        elif conversion in "uoxX":
            value = read_word()
            output.append((spec + ("d" if conversion == "u" else conversion)) % value)
        elif conversion == "c":
            output.append((spec + "s") % chr(read_word() & 0xFF))
        elif conversion == "s":
            address = read_word()
            text = "(null)" if address == 0 else machine.read_c_string(address)
            output.append((spec + "s") % text)
        elif conversion == "p":
            output.append("%08X" % read_word())
        else:
            low, high = read_word(), read_word()
            value = struct.unpack("<d", struct.pack("<II", low, high))[0]
            output.append((spec + conversion) % value)
    output.append(format_text[position:])
    return "".join(output)


def register_crt_stubs(machine) -> None:
    handlers = machine.handlers
    memory = machine

    def cdecl(name):
        def decorate(function):
            handlers[name] = lambda context, argument: StubResult(integer=function(context, argument) or 0)
            return function

        return decorate

    @cdecl("??2@YAPAXI@Z")
    def operator_new(context, argument):
        return memory.allocate_heap(argument(0))

    @cdecl("??3@YAXPAX@Z")
    def operator_delete(context, argument):
        return 0

    @cdecl("sprintf")
    def sprintf(context, argument):
        index = [2]

        def read_word():
            index[0] += 1
            return argument(index[0] - 1)

        text = format_c_string(memory, memory.read_c_string(argument(1)), read_word)
        memory.write_c_string(argument(0), text)
        return len(text)

    @cdecl("strncpy")
    def strncpy(context, argument):
        destination, source, count = argument(0), argument(1), argument(2)
        text = memory.read_c_string(source, count).encode("latin-1")[:count]
        memory.write_bytes(destination, text.ljust(count, b"\0"))
        return destination

    @cdecl("strncat")
    def strncat(context, argument):
        destination, source, count = argument(0), argument(1), argument(2)
        existing = memory.read_c_string(destination)
        memory.write_c_string(destination, existing + memory.read_c_string(source, count))
        return destination

    @cdecl("strncmp")
    def strncmp(context, argument):
        left = memory.read_c_string(argument(0))[: argument(2)]
        right = memory.read_c_string(argument(1))[: argument(2)]
        return (left > right) - (left < right)

    @cdecl("_stricmp")
    def stricmp(context, argument):
        left = memory.read_c_string(argument(0)).lower()
        right = memory.read_c_string(argument(1)).lower()
        return (left > right) - (left < right)

    @cdecl("strchr")
    def strchr(context, argument):
        text = memory.read_c_string(argument(0))
        character = chr(argument(1) & 0xFF)
        if character == "\0":
            return argument(0) + len(text)
        index = text.find(character)
        return 0 if index < 0 else argument(0) + index

    @cdecl("strrchr")
    def strrchr(context, argument):
        text = memory.read_c_string(argument(0))
        index = text.rfind(chr(argument(1) & 0xFF))
        return 0 if index < 0 else argument(0) + index

    @cdecl("strstr")
    def strstr(context, argument):
        index = memory.read_c_string(argument(0)).find(memory.read_c_string(argument(1)))
        return 0 if index < 0 else argument(0) + index

    @cdecl("atoi")
    def atoi(context, argument):
        match = re.match(r"\s*[-+]?\d+", memory.read_c_string(argument(0)))
        return int(match.group(0)) & 0xFFFFFFFF if match else 0

    @cdecl("_itoa")
    def itoa(context, argument):
        value, buffer, radix = struct.unpack("<i", struct.pack("<I", argument(0)))[0], argument(1), argument(2)
        digits = "0123456789abcdefghijklmnopqrstuvwxyz"
        number, text = abs(value), ""
        while True:
            text = digits[number % radix] + text
            number //= radix
            if number == 0:
                break
        memory.write_c_string(buffer, ("-" if value < 0 and radix == 10 else "") + text)
        return buffer

    @cdecl("tolower")
    def tolower(context, argument):
        return ord(chr(argument(0) & 0xFF).lower()) if argument(0) < 256 else argument(0)

    @cdecl("toupper")
    def toupper(context, argument):
        return ord(chr(argument(0) & 0xFF).upper()) if argument(0) < 256 else argument(0)

    @cdecl("isalpha")
    def isalpha(context, argument):
        return 1 if chr(argument(0) & 0xFF).isalpha() and argument(0) < 128 else 0

    @cdecl("islower")
    def islower(context, argument):
        return 1 if chr(argument(0) & 0xFF).islower() and argument(0) < 128 else 0

    @cdecl("srand")
    def srand(context, argument):
        return 0

    @cdecl("_controlfp")
    def controlfp(context, argument):
        if argument(1) & 0x30000 and memory.options.get("fpu") == "auto":
            memory.set_fpu_precision("double" if (argument(0) & 0x30000) == 0x10000 else "single")
        return 0x9001F

    @cdecl("__set_app_type")
    def set_app_type(context, argument):
        return 0

    @cdecl("__setusermatherr")
    def set_user_math_error(context, argument):
        return 0

    @cdecl("_initterm")
    def initterm(context, argument):
        raise NotImplementedError

    @cdecl("__p__fmode")
    def pointer_fmode(context, argument):
        return memory.persistent_cell("fmode")

    @cdecl("__p__commode")
    def pointer_commode(context, argument):
        return memory.persistent_cell("commode")

    @cdecl("__getmainargs")
    def getmainargs(context, argument):
        memory.write_u32(argument(0), 1)
        memory.write_u32(argument(1), memory.persistent_cell("argv"))
        memory.write_u32(argument(2), memory.persistent_cell("environment"))
        return 0

    @cdecl("_errno")
    def errno(context, argument):
        return memory.persistent_cell("errno")

    @cdecl("_purecall")
    def purecall(context, argument):
        raise RuntimeError("pure virtual function call")

    @cdecl("exit")
    def exit_process(context, argument):
        memory.request_stop(f"exit({argument(0)})")

    @cdecl("_exit")
    def exit_process_quick(context, argument):
        memory.request_stop(f"exit({argument(0)})")

    @cdecl("_XcptFilter")
    def exception_filter(context, argument):
        return 0

    @cdecl("__CxxFrameHandler")
    def cxx_frame_handler(context, argument):
        raise RuntimeError("C++ exception raised")

    @cdecl("_except_handler3")
    def except_handler(context, argument):
        raise RuntimeError("structured exception raised")

    @cdecl("?terminate@@YAXXZ")
    def terminate(context, argument):
        raise RuntimeError("terminate called")

    @cdecl("_onexit")
    def onexit(context, argument):
        return argument(0)

    @cdecl("__dllonexit")
    def dllonexit(context, argument):
        return argument(0)

    @cdecl("_adjust_fdiv")
    def adjust_fdiv(context, argument):
        return 0

    register_file_stubs(machine, cdecl)


def register_file_stubs(machine, cdecl) -> None:
    files = machine.c_files = {}
    state = {"next": 3}

    @cdecl("_open")
    def open_file(context, argument):
        path = machine.operating_system.resolve_path(machine.read_c_string(argument(0)))
        flags = argument(1)
        if path is None or (flags & 0x0100) != 0 or (flags & 3) != 0:
            return 0xFFFFFFFF
        handle = state["next"]
        state["next"] += 1
        files[handle] = [open(path, "rb").read(), 0]
        return handle

    @cdecl("_close")
    def close_file(context, argument):
        files.pop(argument(0), None)
        return 0

    @cdecl("_read")
    def read_file(context, argument):
        entry = files.get(argument(0))
        if entry is None:
            return 0xFFFFFFFF
        data = entry[0][entry[1] : entry[1] + argument(2)]
        entry[1] += len(data)
        machine.write_bytes(argument(1), data)
        return len(data)

    @cdecl("_lseek")
    def seek_file(context, argument):
        entry = files.get(argument(0))
        if entry is None:
            return 0xFFFFFFFF
        offset = struct.unpack("<i", struct.pack("<I", argument(1)))[0]
        origin = argument(2)
        entry[1] = offset if origin == 0 else entry[1] + offset if origin == 1 else len(entry[0]) + offset
        return entry[1]

    @cdecl("_tell")
    def tell_file(context, argument):
        entry = files.get(argument(0))
        return 0xFFFFFFFF if entry is None else entry[1]

    @cdecl("_access")
    def access_file(context, argument):
        return 0 if machine.operating_system.resolve_path(machine.read_c_string(argument(0))) is not None else 0xFFFFFFFF

    @cdecl("_write")
    def write_file(context, argument):
        return argument(2)

    @cdecl("_commit")
    def commit_file(context, argument):
        return 0

    @cdecl("remove")
    def remove_file(context, argument):
        return 0xFFFFFFFF

    @cdecl("_mkdir")
    def make_directory(context, argument):
        return 0

    @cdecl("_chdir")
    def change_directory(context, argument):
        return 0

    @cdecl("_getcwd")
    def get_current_directory(context, argument):
        if argument(0) == 0:
            return machine.new_c_string("C:\\LEGO")
        machine.write_c_string(argument(0), "C:\\LEGO")
        return argument(0)

"""Win32 imports of both images: a small operating system on the host (files from the game folder, heaps, thread storage, a scripted clock)."""

import os
import struct

from stubs import StubResult

INVALID_HANDLE = 0xFFFFFFFF
WINDOW_HANDLE = 0x00010001
DLL_BASES = {"golsoft.dll": 0, "goldp.dll": 0x10000000}

# Argument bytes popped by the callee (stdcall) for each import.
STDCALL_ARGUMENT_COUNTS = {
    "CreateFileA": 7, "GetFileSize": 2, "WaitForSingleObject": 2, "CreateMutexA": 3, "MultiByteToWideChar": 6,
    "ReleaseMutex": 1, "CloseHandle": 1, "GetCurrentProcessId": 0, "GetCurrentProcess": 0, "SetPriorityClass": 2,
    "Sleep": 1, "OutputDebugStringA": 1, "FreeLibrary": 1, "LoadLibraryA": 1, "ReadFile": 5, "SetFilePointer": 4,
    "GetFileAttributesA": 1, "GetLastError": 0, "GetStartupInfoA": 1, "GetModuleHandleA": 1, "GetProcAddress": 2,
    "lstrlenA": 1, "HeapSize": 3, "LeaveCriticalSection": 1, "RtlUnwind": 4, "InterlockedDecrement": 1,
    "InterlockedIncrement": 1, "GetFileType": 1, "WriteFile": 5, "FlushFileBuffers": 1, "GetCommandLineA": 0,
    "GetVersion": 0, "GetCurrentThreadId": 0, "TlsSetValue": 2, "TlsAlloc": 0, "TlsFree": 1, "SetLastError": 1,
    "TlsGetValue": 1, "HeapFree": 3, "HeapAlloc": 3, "ExitProcess": 1, "TerminateProcess": 2, "HeapReAlloc": 4,
    "RaiseException": 4, "InitializeCriticalSection": 1, "DeleteCriticalSection": 1, "EnterCriticalSection": 1,
    "GetOEMCP": 0, "WideCharToMultiByte": 8, "LCMapStringA": 6, "LCMapStringW": 6, "SetStdHandle": 2,
    "SetHandleCount": 1, "GetStdHandle": 1, "SetEndOfFile": 1, "GetModuleFileNameA": 3, "FreeEnvironmentStringsA": 1,
    "FreeEnvironmentStringsW": 1, "GetEnvironmentStrings": 0, "GetEnvironmentStringsW": 0,
    "GetEnvironmentVariableA": 3, "GetVersionExA": 1, "HeapDestroy": 1, "HeapCreate": 3, "VirtualFree": 3,
    "SetUnhandledExceptionFilter": 1, "IsBadReadPtr": 2, "IsBadWritePtr": 2, "IsBadCodePtr": 1, "VirtualAlloc": 4,
    "GetStringTypeA": 5, "GetStringTypeW": 4, "GetCPInfo": 2, "GetACP": 0,
    "TranslateMessage": 1, "LoadIconA": 2, "CreateWindowExA": 12, "ShowWindow": 2, "SetWindowLongA": 3,
    "ClientToScreen": 2, "RegisterClassA": 1, "LoadCursorA": 2, "DestroyWindow": 1, "SetFocus": 1, "UpdateWindow": 1,
    "SetWindowPos": 7, "GetSystemMetrics": 1, "AdjustWindowRect": 3, "GetCursorPos": 1, "WaitMessage": 0,
    "MsgWaitForMultipleObjects": 5, "ReleaseDC": 2, "ShowCursor": 1, "BringWindowToTop": 1, "EnumDisplaySettingsA": 3,
    "GetDC": 1, "ChangeDisplaySettingsA": 2, "MessageBoxA": 4, "GetForegroundWindow": 0, "GetWindowThreadProcessId": 2,
    "GetActiveWindow": 0, "GetWindowLongA": 2, "DefWindowProcA": 4, "PostQuitMessage": 1, "GetUpdateRect": 3,
    "BeginPaint": 2, "FillRect": 3, "EndPaint": 2, "SetCursor": 1, "PeekMessageA": 5, "DispatchMessageA": 1,
    "GetClientRect": 2, "DialogBoxIndirectParamA": 5, "EndDialog": 2, "SendMessageA": 4, "SendDlgItemMessageA": 5,
    "GetStockObject": 1, "CreateSolidBrush": 1, "DeleteObject": 1, "GetDeviceCaps": 2,
    "RegCloseKey": 1, "RegQueryValueExA": 6, "RegOpenKeyA": 3,
    "CoInitialize": 1, "CoCreateInstance": 5, "CoUninitialize": 0,
    "ordinal_1": 3, "DirectInputCreateA": 4,
    "timeGetTime": 0, "timeKillEvent": 1, "timeSetEvent": 5,
    "DirectDrawCreate": 3, "DirectDrawCreateClipper": 3, "DirectDrawEnumerateA": 2,
}


class Win32:
    def __init__(self, machine):
        self.machine = machine
        self.last_error = 0
        self.now_milliseconds = 100000
        self.handles = {}
        self.next_handle = 0x100
        self.tls_values = {}
        self.next_tls_index = 0
        self.window_long = {}
        self.command_line = machine.options.get("command_line", "LEGORacers.exe -novideo")
        self.written_files = {}

    def resolve_path(self, path: str):
        parts = [part for part in path.replace("\\", "/").split("/") if part not in ("", ".")]
        if len(parts) >= 2 and parts[0].endswith(":"):
            parts = parts[1:]
        current = self.machine.game_files_directory
        for part in parts:
            try:
                names = os.listdir(current)
            except OSError:
                return None
            match = next((name for name in names if name.lower() == part.lower()), None)
            if match is None:
                return None
            current = os.path.join(current, match)
        return current if os.path.isfile(current) or os.path.isdir(current) else None

    def new_handle(self, value) -> int:
        handle = self.next_handle
        self.next_handle += 4
        self.handles[handle] = value
        return handle

    def register(self, machine) -> None:
        for name, count in STDCALL_ARGUMENT_COUNTS.items():
            method = getattr(self, "api_" + name, None)
            if method is None:
                machine.handlers[name] = self.make_default_handler(name, count)
            else:
                machine.handlers[name] = self.make_handler(method, count)

    def make_handler(self, method, count):
        def handler(context, argument):
            result = method(argument)
            if isinstance(result, StubResult):
                return result
            return StubResult(integer=(result or 0) & 0xFFFFFFFF, callee_cleanup_bytes=count * 4)

        return handler

    def make_default_handler(self, name, count):
        def handler(context, argument):
            return StubResult(integer=1, callee_cleanup_bytes=count * 4)

        return handler

    # Kernel32 -----------------------------------------------------------------------------------------------------

    def api_CreateFileA(self, argument):
        machine = self.machine
        path = machine.read_c_string(argument(0))
        access, disposition = argument(1), argument(4)
        if access & 0x40000000 or disposition in (1, 2, 4):
            self.written_files[path.lower()] = bytearray()
            return self.new_handle({"data": self.written_files[path.lower()], "position": 0, "path": path})
        real_path = self.resolve_path(path)
        if real_path is None or os.path.isdir(real_path):
            self.last_error = 2
            return INVALID_HANDLE
        with open(real_path, "rb") as file:
            data = file.read()
        return self.new_handle({"data": data, "position": 0, "path": path})

    def api_GetFileSize(self, argument):
        entry = self.handles.get(argument(0))
        if entry is None:
            return INVALID_HANDLE
        if argument(1):
            self.machine.write_u32(argument(1), 0)
        return len(entry["data"])

    def api_ReadFile(self, argument):
        entry = self.handles.get(argument(0))
        if entry is None:
            return 0
        data = bytes(entry["data"][entry["position"] : entry["position"] + argument(2)])
        entry["position"] += len(data)
        self.machine.write_bytes(argument(1), data)
        if argument(3):
            self.machine.write_u32(argument(3), len(data))
        return 1

    def api_WriteFile(self, argument):
        entry = self.handles.get(argument(0))
        count = argument(2)
        if entry is not None and isinstance(entry["data"], bytearray):
            entry["data"][entry["position"] : entry["position"] + count] = self.machine.read_bytes(argument(1), count)
            entry["position"] += count
        if argument(3):
            self.machine.write_u32(argument(3), count)
        return 1

    def api_SetFilePointer(self, argument):
        entry = self.handles.get(argument(0))
        if entry is None:
            return INVALID_HANDLE
        distance = struct.unpack("<i", struct.pack("<I", argument(1)))[0]
        method = argument(3)
        base = 0 if method == 0 else entry["position"] if method == 1 else len(entry["data"])
        entry["position"] = base + distance
        return entry["position"]

    def api_CloseHandle(self, argument):
        self.handles.pop(argument(0), None)
        return 1

    def api_GetFileAttributesA(self, argument):
        path = self.resolve_path(self.machine.read_c_string(argument(0)))
        if path is None:
            self.last_error = 2
            return INVALID_HANDLE
        return 0x10 if os.path.isdir(path) else 0x80

    def api_GetLastError(self, argument):
        return self.last_error

    def api_SetLastError(self, argument):
        self.last_error = argument(0)

    def api_GetFileType(self, argument):
        return 1

    def api_GetStdHandle(self, argument):
        return 0x1000 + argument(0) % 16

    def api_GetModuleHandleA(self, argument):
        name = argument(0)
        if name == 0:
            return 0x400000
        return DLL_BASES.get(self.machine.read_c_string(name).lower(), 0x400000)

    def api_LoadLibraryA(self, argument):
        base = DLL_BASES.get(self.machine.read_c_string(argument(0)).lower())
        if base is None:
            raise RuntimeError(f"LoadLibraryA({self.machine.read_c_string(argument(0))!r})")
        return base

    def api_FreeLibrary(self, argument):
        return 1

    def api_GetProcAddress(self, argument):
        name = self.machine.read_c_string(argument(1))
        for image in self.machine.images:
            exports = dict(image.exports)
            if name in exports:
                return exports[name]
        return 0

    def api_GetModuleFileNameA(self, argument):
        self.machine.write_c_string(argument(1), "C:\\LEGO\\LEGORacers.exe")
        return len("C:\\LEGO\\LEGORacers.exe")

    def api_GetCommandLineA(self, argument):
        return self.machine.persistent_string("command_line", self.command_line)

    def api_GetStartupInfoA(self, argument):
        self.machine.write_bytes(argument(0), bytes(68))
        self.machine.write_u32(argument(0), 68)

    def api_GetVersion(self, argument):
        return 0x0A280105

    def api_GetVersionExA(self, argument):
        base = argument(0)
        self.machine.write_bytes(base + 4, struct.pack("<IIII", 4, 0, 1381, 2))
        return 1

    def api_GetCurrentProcessId(self, argument):
        return 1000

    def api_GetCurrentThreadId(self, argument):
        return 1004

    def api_GetCurrentProcess(self, argument):
        return 0xFFFFFFFF

    def api_Sleep(self, argument):
        self.now_milliseconds += argument(0)

    def api_GetACP(self, argument):
        return 1252

    def api_GetOEMCP(self, argument):
        return 437

    def api_GetCPInfo(self, argument):
        self.machine.write_bytes(argument(1), struct.pack("<I", 1) + bytes(14))
        return 1

    def api_lstrlenA(self, argument):
        return len(self.machine.read_c_string(argument(0)))

    def api_MultiByteToWideChar(self, argument):
        text = self.machine.read_c_string(argument(2), argument(3) if argument(3) != INVALID_HANDLE else 4096)
        wide = text.encode("utf-16-le") + b"\0\0"
        if argument(5) == 0:
            return len(wide) // 2
        self.machine.write_bytes(argument(4), wide[: argument(5) * 2])
        return len(wide) // 2

    def api_WideCharToMultiByte(self, argument):
        count = argument(3)
        raw = self.machine.read_bytes(argument(2), (count if count != INVALID_HANDLE else 512) * 2)
        text = raw.decode("utf-16-le", errors="replace")
        if count == INVALID_HANDLE:
            text = text.split("\0")[0] + "\0"
        encoded = text.encode("latin-1", errors="replace")
        if argument(6):
            self.machine.write_bytes(argument(5), encoded[: argument(6)])
        return len(encoded)

    def api_GetStringTypeA(self, argument):
        count = argument(3) if argument(3) != INVALID_HANDLE else 0
        self.machine.write_bytes(argument(4), bytes(count * 2))
        return 1

    def api_GetStringTypeW(self, argument):
        count = argument(2) if argument(2) != INVALID_HANDLE else 0
        self.machine.write_bytes(argument(3), bytes(count * 2))
        return 1

    def api_LCMapStringA(self, argument):
        count = argument(3)
        if argument(5):
            self.machine.write_bytes(argument(4), self.machine.read_bytes(argument(2), count))
        return count

    def api_LCMapStringW(self, argument):
        count = argument(3)
        if argument(5):
            self.machine.write_bytes(argument(4), self.machine.read_bytes(argument(2), count * 2))
        return count

    # Heap and memory ----------------------------------------------------------------------------------------------

    def api_HeapCreate(self, argument):
        return self.new_handle("heap")

    def api_HeapDestroy(self, argument):
        return 1

    def api_HeapAlloc(self, argument):
        return self.machine.allocate_heap(argument(2))

    def api_HeapFree(self, argument):
        return 1

    def api_HeapSize(self, argument):
        return self.machine.heap_sizes.get(argument(2), 0)

    def api_HeapReAlloc(self, argument):
        old, size = argument(2), argument(3)
        new = self.machine.allocate_heap(size)
        old_size = self.machine.heap_sizes.get(old, 0)
        if old and old_size:
            self.machine.write_bytes(new, self.machine.read_bytes(old, min(old_size, size)))
        return new

    def api_VirtualAlloc(self, argument):
        return self.machine.allocate_heap(argument(1), 0x1000)

    def api_VirtualFree(self, argument):
        return 1

    def api_IsBadReadPtr(self, argument):
        return 0

    def api_IsBadWritePtr(self, argument):
        return 0

    def api_IsBadCodePtr(self, argument):
        return 0

    # Synchronisation and thread storage ---------------------------------------------------------------------------

    def api_InterlockedIncrement(self, argument):
        value = (self.machine.read_u32(argument(0)) + 1) & 0xFFFFFFFF
        self.machine.write_u32(argument(0), value)
        return value

    def api_InterlockedDecrement(self, argument):
        value = (self.machine.read_u32(argument(0)) - 1) & 0xFFFFFFFF
        self.machine.write_u32(argument(0), value)
        return value

    def api_TlsAlloc(self, argument):
        index = self.next_tls_index
        self.next_tls_index += 1
        return index

    def api_TlsSetValue(self, argument):
        self.tls_values[argument(0)] = argument(1)
        return 1

    def api_TlsGetValue(self, argument):
        return self.tls_values.get(argument(0), 0)

    def api_CreateMutexA(self, argument):
        return self.new_handle("mutex")

    def api_WaitForSingleObject(self, argument):
        return 0

    def api_GetEnvironmentStrings(self, argument):
        return self.machine.persistent_string("environment_strings", "\0")

    def api_GetEnvironmentStringsW(self, argument):
        return self.machine.persistent_cell("environment_wide")

    def api_GetEnvironmentVariableA(self, argument):
        return 0

    def api_RtlUnwind(self, argument):
        raise RuntimeError("RtlUnwind")

    def api_RaiseException(self, argument):
        raise RuntimeError(f"RaiseException({argument(0):#x})")

    def api_ExitProcess(self, argument):
        self.machine.request_stop(f"exit({argument(0)})")

    def api_TerminateProcess(self, argument):
        self.machine.request_stop(f"terminate({argument(1)})")

    # User32, GDI32, registry and the rest -------------------------------------------------------------------------

    def api_GetSystemMetrics(self, argument):
        return {0: 640, 1: 480, 4: 19, 5: 1, 6: 1, 7: 3, 8: 3, 15: 20, 32: 4, 33: 4}.get(argument(0), 0)

    def api_CreateWindowExA(self, argument):
        return WINDOW_HANDLE

    def api_RegisterClassA(self, argument):
        return 0xC001

    def api_GetClientRect(self, argument):
        self.machine.write_bytes(argument(1), struct.pack("<iiii", 0, 0, 640, 480))
        return 1

    def api_AdjustWindowRect(self, argument):
        return 1

    def api_ClientToScreen(self, argument):
        return 1

    def api_GetCursorPos(self, argument):
        self.machine.write_bytes(argument(0), struct.pack("<ii", 320, 240))
        return 1

    def api_GetWindowLongA(self, argument):
        return self.window_long.get(argument(1), 0)

    def api_SetWindowLongA(self, argument):
        previous = self.window_long.get(argument(1), 0)
        self.window_long[argument(1)] = argument(2)
        return previous

    def api_GetForegroundWindow(self, argument):
        return WINDOW_HANDLE

    def api_GetActiveWindow(self, argument):
        return WINDOW_HANDLE

    def api_GetDC(self, argument):
        return 0x2000

    def api_GetDeviceCaps(self, argument):
        return {12: 32, 14: 1, 8: 640, 10: 480}.get(argument(1), 0)

    def api_PeekMessageA(self, argument):
        return 0

    def api_GetWindowThreadProcessId(self, argument):
        return 1004

    def api_EnumDisplaySettingsA(self, argument):
        return 0

    def api_RegOpenKeyA(self, argument):
        return 2

    def api_RegQueryValueExA(self, argument):
        return 2

    def api_MessageBoxA(self, argument):
        text = self.machine.read_c_string(argument(1))
        raise RuntimeError(f"MessageBoxA: {text}")

    def api_OutputDebugStringA(self, argument):
        if self.machine.is_trace_enabled:
            print("OutputDebugString:", self.machine.read_c_string(argument(0)))

    def api_CoInitialize(self, argument):
        return 0

    def api_timeGetTime(self, argument):
        return self.now_milliseconds & 0xFFFFFFFF

    def api_timeSetEvent(self, argument):
        return 1

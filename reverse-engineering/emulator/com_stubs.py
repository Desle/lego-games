"""Fake DirectDraw, Direct3D, DirectSound and DirectInput: objects whose methods succeed and answer plausibly. Nothing is drawn or played."""

import inspect
import struct

from stubs import StubResult

S_OK = 0
E_FAIL = 0x80004005
DDERR_UNSUPPORTED = 0x80004002

UNKNOWN = [("QueryInterface", 2), ("AddRef", 0), ("Release", 0)]

# Method names and argument counts (without `this`) in vtable order.
INTERFACES = {
    "DirectDraw": UNKNOWN + [
        ("Compact", 0), ("CreateClipper", 3), ("CreatePalette", 4), ("CreateSurface", 3), ("DuplicateSurface", 2),
        ("EnumDisplayModes", 4), ("EnumSurfaces", 4), ("FlipToGDISurface", 0), ("GetCaps", 2), ("GetDisplayMode", 1),
        ("GetFourCCCodes", 2), ("GetGDISurface", 1), ("GetMonitorFrequency", 1), ("GetScanLine", 1),
        ("GetVerticalBlankStatus", 1), ("Initialize", 1), ("RestoreDisplayMode", 0), ("SetCooperativeLevel", 2),
        ("SetDisplayMode", 3), ("WaitForVerticalBlank", 2),
    ],
}
INTERFACES["DirectDraw2"] = INTERFACES["DirectDraw"][:-2] + [("SetDisplayMode", 5), ("WaitForVerticalBlank", 2), ("GetAvailableVidMem", 3)]
INTERFACES["DirectDraw4"] = INTERFACES["DirectDraw2"] + [
    ("GetSurfaceFromDC", 2), ("RestoreAllSurfaces", 0), ("TestCooperativeLevel", 0), ("GetDeviceIdentifier", 2),
]
SURFACE = UNKNOWN + [
    ("AddAttachedSurface", 1), ("AddOverlayDirtyRect", 1), ("Blt", 5), ("BltBatch", 3), ("BltFast", 5),
    ("DeleteAttachedSurface", 2), ("EnumAttachedSurfaces", 2), ("EnumOverlayZOrders", 3), ("Flip", 2),
    ("GetAttachedSurface", 2), ("GetBltStatus", 1), ("GetCaps", 1), ("GetClipper", 1), ("GetColorKey", 2),
    ("GetDC", 1), ("GetFlipStatus", 1), ("GetOverlayPosition", 2), ("GetPalette", 1), ("GetPixelFormat", 1),
    ("GetSurfaceDesc", 1), ("Initialize", 2), ("IsLost", 0), ("Lock", 4), ("ReleaseDC", 1), ("Restore", 0),
    ("SetClipper", 1), ("SetColorKey", 2), ("SetOverlayPosition", 2), ("SetPalette", 1), ("Unlock", 1),
    ("UpdateOverlay", 5), ("UpdateOverlayDisplay", 1), ("UpdateOverlayZOrder", 2),
]
INTERFACES["Surface"] = SURFACE
INTERFACES["Surface3"] = SURFACE + [("GetDDInterface", 1), ("PageLock", 1), ("PageUnlock", 1), ("SetSurfaceDesc", 2)]
INTERFACES["Surface4"] = INTERFACES["Surface3"] + [
    ("SetPrivateData", 4), ("GetPrivateData", 3), ("FreePrivateData", 1), ("GetUniquenessValue", 1), ("ChangeUniquenessValue", 0),
]
INTERFACES["Palette"] = UNKNOWN + [("GetCaps", 1), ("GetEntries", 4), ("Initialize", 3), ("SetEntries", 4)]
INTERFACES["Clipper"] = UNKNOWN + [("GetClipList", 3), ("GetHWnd", 1), ("Initialize", 2), ("IsClipListChanged", 1), ("SetClipList", 2), ("SetHWnd", 2)]
INTERFACES["Direct3D"] = UNKNOWN + [("Initialize", 1), ("EnumDevices", 2), ("CreateLight", 2), ("CreateMaterial", 2), ("CreateViewport", 2), ("FindDevice", 2)]
INTERFACES["Direct3D2"] = INTERFACES["Direct3D"][:3] + [
    ("EnumDevices", 2), ("CreateLight", 2), ("CreateMaterial", 2), ("CreateViewport", 2), ("FindDevice", 2), ("CreateDevice", 3),
]
INTERFACES["Direct3D3"] = INTERFACES["Direct3D2"][:-1] + [("CreateDevice", 4), ("CreateVertexBuffer", 4), ("EnumZBufferFormats", 3), ("EvictManagedTextures", 0)]
INTERFACES["Direct3DDevice"] = UNKNOWN + [
    ("Initialize", 3), ("GetCaps", 2), ("SwapTextureHandles", 2), ("GetStats", 1), ("AddViewport", 1), ("DeleteViewport", 1),
    ("NextViewport", 3), ("Execute", 3), ("Pick", 5), ("GetPickRecords", 2), ("EnumTextureFormats", 2), ("CreateMatrix", 1),
    ("SetMatrix", 2), ("GetMatrix", 2), ("DeleteMatrix", 1), ("BeginScene", 0), ("EndScene", 0), ("GetDirect3D", 1),
]
DEVICE_COMMON = [
    ("AddViewport", 1), ("DeleteViewport", 1), ("NextViewport", 3), ("EnumTextureFormats", 2), ("BeginScene", 0),
    ("EndScene", 0), ("GetDirect3D", 1), ("SetCurrentViewport", 1), ("GetCurrentViewport", 1), ("SetRenderTarget", 2),
    ("GetRenderTarget", 1), ("Begin", 3), ("BeginIndexed", 4), ("Vertex", 2), ("Index", 1), ("End", 1), ("GetRenderState", 2),
    ("SetRenderState", 2), ("GetLightState", 2), ("SetLightState", 2), ("SetTransform", 2), ("GetTransform", 2),
    ("MultiplyTransform", 2), ("DrawPrimitive", 5),
]
INTERFACES["Direct3DDevice2"] = UNKNOWN + [("GetCaps", 2), ("SwapTextureHandles", 2), ("GetStats", 1)] + DEVICE_COMMON + [
    ("DrawIndexedPrimitive", 6), ("SetClipStatus", 1), ("GetClipStatus", 1),
]
INTERFACES["Direct3DDevice3"] = UNKNOWN + [("GetCaps", 2), ("GetStats", 1)] + DEVICE_COMMON + [
    ("DrawIndexedPrimitive", 7), ("SetClipStatus", 1), ("GetClipStatus", 1), ("DrawPrimitiveStrided", 5),
    ("DrawIndexedPrimitiveStrided", 7), ("DrawPrimitiveVB", 5), ("DrawIndexedPrimitiveVB", 7), ("ComputeSphereVisibility", 5),
    ("GetTexture", 2), ("SetTexture", 2), ("GetTextureStageState", 3), ("SetTextureStageState", 3), ("ValidateDevice", 1),
]
INTERFACES["Direct3DViewport"] = UNKNOWN + [
    ("Initialize", 1), ("GetViewport", 1), ("SetViewport", 1), ("TransformVertices", 4), ("LightElements", 2),
    ("SetBackground", 1), ("GetBackground", 2), ("SetBackgroundDepth", 1), ("GetBackgroundDepth", 2), ("Clear", 3),
    ("AddLight", 1), ("DeleteLight", 1), ("NextLight", 3),
]
INTERFACES["Direct3DViewport2"] = INTERFACES["Direct3DViewport"] + [("GetViewport2", 1), ("SetViewport2", 1)]
INTERFACES["Direct3DViewport3"] = INTERFACES["Direct3DViewport2"] + [("SetBackgroundDepth2", 1), ("GetBackgroundDepth2", 2), ("Clear2", 5)]
INTERFACES["Direct3DMaterial"] = UNKNOWN + [("Initialize", 1), ("SetMaterial", 1), ("GetMaterial", 1), ("GetHandle", 2), ("Reserve", 0), ("Unreserve", 0)]
INTERFACES["Direct3DMaterial3"] = UNKNOWN + [("SetMaterial", 1), ("GetMaterial", 1), ("GetHandle", 2)]
INTERFACES["Direct3DTexture"] = UNKNOWN + [("Initialize", 2), ("GetHandle", 2), ("PaletteChanged", 2), ("Load", 1), ("Unload", 0)]
INTERFACES["Direct3DTexture2"] = UNKNOWN + [("GetHandle", 2), ("PaletteChanged", 2), ("Load", 1)]
INTERFACES["Direct3DLight"] = UNKNOWN + [("Initialize", 1), ("SetLight", 1), ("GetLight", 1)]
INTERFACES["DirectSound"] = UNKNOWN + [
    ("CreateSoundBuffer", 3), ("GetCaps", 1), ("DuplicateSoundBuffer", 2), ("SetCooperativeLevel", 2), ("Compact", 0),
    ("GetSpeakerConfig", 1), ("SetSpeakerConfig", 1), ("Initialize", 1),
]
INTERFACES["DirectSoundBuffer"] = UNKNOWN + [
    ("GetCaps", 1), ("GetCurrentPosition", 2), ("GetFormat", 4), ("GetVolume", 1), ("GetPan", 1), ("GetFrequency", 1),
    ("GetStatus", 1), ("Initialize", 2), ("Lock", 7), ("Play", 3), ("SetCurrentPosition", 1), ("SetFormat", 1),
    ("SetVolume", 1), ("SetPan", 1), ("SetFrequency", 1), ("Stop", 0), ("Unlock", 4), ("Restore", 0),
]
INTERFACES["DirectInput"] = UNKNOWN + [("CreateDevice", 3), ("EnumDevices", 4), ("GetDeviceStatus", 1), ("RunControlPanel", 2), ("Initialize", 2)]
INTERFACES["DirectInputDevice"] = UNKNOWN + [
    ("GetCapabilities", 1), ("EnumObjects", 3), ("GetProperty", 2), ("SetProperty", 2), ("Acquire", 0), ("Unacquire", 0),
    ("GetDeviceState", 2), ("GetDeviceData", 4), ("SetDataFormat", 1), ("SetEventNotification", 1), ("SetCooperativeLevel", 2),
    ("GetObjectInfo", 3), ("GetDeviceInfo", 1), ("RunControlPanel", 2), ("Initialize", 3),
]

INTERFACES["DirectInputDevice2"] = INTERFACES["DirectInputDevice"] + [
    ("CreateEffect", 4), ("EnumEffects", 3), ("GetEffectInfo", 2), ("GetForceFeedbackState", 1), ("SendForceFeedbackCommand", 1),
    ("EnumCreatedEffectObjects", 3), ("Escape", 1), ("Poll", 0), ("SendDeviceData", 4),
]

# GUID first words of the interfaces the games asks for in QueryInterface.
INTERFACE_IDENTIFIERS = {
    0x6C14DB80: "DirectDraw",
    0xB3A6F3E0: "DirectDraw2",
    0x9C59509A: "DirectDraw4",
    0x6C14DB81: "Surface",
    0x57805885: "Surface2",
    0xDA044E00: "Surface3",
    0x0B2B8630: "Surface4",
    0x3BBA0080: "Direct3D",
    0x6AAE1EC1: "Direct3D2",
    0xBB223240: "Direct3D3",
    0x2CDCD9E0: "Direct3DTexture",
    0x93281502: "Direct3DTexture2",
    0xF5049E77: "Direct3DDevice",
    0x5944E682: "DirectInputDevice2",
    0x93281501: "Direct3DDevice2",
    0xB0AB3B60: "Direct3DDevice3",
}
INTERFACES["Surface2"] = INTERFACES["Surface3"][:-1]


from com_display import DisplayMethods


class ComWorld(DisplayMethods):
    def __init__(self, machine):
        self.machine = machine
        self.vtables = {}
        self.object_kinds = {}
        self.hooks = {}
        self.log = []
        self.input_queues = {}

    def vtable_for(self, kind: str) -> int:
        if kind not in self.vtables:
            methods = INTERFACES[kind]
            address = self.machine.allocate_heap(4 * (len(methods) + 4), 16)
            for index, (method, _) in enumerate(methods):
                stub = self.machine.new_stub(f"com!{kind}.{method}")
                self.machine.write_u32(address + 4 * index, stub)
                self.machine.handlers[f"{kind}.{method}"] = self.make_handler(kind, method, _)
            for index in range(len(methods), len(methods) + 24):
                stub = self.machine.new_stub(f"com!{kind}.unknown{index}")
                self.machine.write_u32(address + 4 * index, stub)
                self.machine.handlers[f"{kind}.unknown{index}"] = self.make_unknown_handler(kind, index)
            self.vtables[kind] = address
        return self.vtables[kind]

    @staticmethod
    def make_unknown_handler(kind, index):
        def handler(context, argument):
            raise RuntimeError(f"{kind} method {index} is not in the table (called from {argument(-1) if False else 'caller'})")

        return handler

    def create(self, kind: str, **fields) -> int:
        address = self.machine.allocate_heap(256, 16)
        self.machine.write_u32(address, self.vtable_for(kind))
        self.object_kinds[address] = {"kind": kind, "references": 1, **fields}
        return address

    def find_behaviour(self, kind, method):
        base_kind = kind.rstrip("0123456789")
        for candidate in (kind, base_kind):
            behaviour = getattr(self, f"{candidate}_{method}", None)
            if behaviour is not None:
                return behaviour
        return getattr(self, f"any_{method}", None)

    def make_handler(self, kind, method, count):
        def handler(context, argument):
            this = argument(0)
            record = self.object_kinds.get(this)
            actual_kind = record["kind"] if record else kind
            specific = self.find_behaviour(actual_kind, method)
            if specific is not None and inspect.isgeneratorfunction(specific):
                self.log.append(f"{actual_kind}.{method}")
                return specific(this, record, argument)
            return plain_handler(context, argument)

        def plain_handler(context, argument):
            this = argument(0)
            record = self.object_kinds.get(this)
            actual_kind = record["kind"] if record else kind
            specific = self.find_behaviour(actual_kind, method)
            self.log.append(f"{actual_kind}.{method}")
            result = S_OK if specific is None else specific(this, record, argument)
            return StubResult(integer=(result or 0) & 0xFFFFFFFF, callee_cleanup_bytes=(count + 1) * 4)

        handler.callee_cleanup_bytes = (count + 1) * 4
        return handler

    # DirectDraw ---------------------------------------------------------------------------------------------------

    def DirectDraw_GetCaps(self, this, record, argument):
        for pointer in (argument(1), argument(2)):
            if pointer:
                size = self.machine.read_u32(pointer)
                data = bytearray(size)
                struct.pack_into("<III", data, 0, size, 0xFFFFFFFF, 0xFFFFFFFF)
                struct.pack_into("<II", data, 0x38, 16 * 1024 * 1024, 12 * 1024 * 1024)
                self.machine.write_bytes(pointer, bytes(data))
        return S_OK

    DirectDraw2_GetCaps = DirectDraw_GetCaps
    DirectDraw4_GetCaps = DirectDraw_GetCaps

    def DirectDraw_SetCooperativeLevel(self, this, record, argument):
        if argument(2) & 0x800 and self.machine.options.get("fpu") == "auto":
            self.machine.set_fpu_precision("single")
        return S_OK

    def DirectDraw_GetDisplayMode(self, this, record, argument):
        data = bytearray(108)
        struct.pack_into("<IIII", data, 0, 108, 0x100F, 480, 640)
        struct.pack_into("<IIIIIIII", data, 0x48, 32, 0x40, 0, 16, 0xF800, 0x07E0, 0x001F, 0)
        self.machine.write_bytes(argument(1), bytes(data))
        return S_OK

    def Direct3D3_EnumDevices(self, this, record, argument):
        yield from self.enumerate_devices(argument)

    Direct3D2_EnumDevices = Direct3D3_EnumDevices
    Direct3D_EnumDevices = Direct3D3_EnumDevices

    def enumerate_devices(self, argument):
        description = self.machine.new_c_string("Direct3D HAL")
        name = self.machine.new_c_string("Direct3D HAL")
        hardware = self.machine.allocate_heap(0xFC, 16)
        software = self.machine.allocate_heap(0xFC, 16)
        self.machine.write_bytes(hardware, self.device_description(is_hardware=True))
        self.machine.write_bytes(software, self.device_description(is_hardware=False))
        guid = self.machine.allocate_heap(16, 16)
        self.machine.write_bytes(guid, struct.pack("<IHH8B", 0x84E63DE0, 0x46AA, 0x11CF, 0x81, 0x6F, 0, 0, 0xC0, 0x20, 0x15, 0x6E))
        yield argument(1), [guid, description, name, hardware, software, argument(2)]
        return S_OK

    @staticmethod
    def device_description(is_hardware: bool) -> bytes:
        data = bytearray(0xFC)
        if not is_hardware:
            struct.pack_into("<I", data, 0, 0xFC)
            return bytes(data)
        struct.pack_into("<III", data, 0, 0xFC, 0x7FF, 2)
        struct.pack_into("<I", data, 0x0C, 0x0000F0FF)
        struct.pack_into("<II", data, 0x10, 8, 0xFFFFFFFF)
        struct.pack_into("<I", data, 0x18, 1)
        struct.pack_into("<IIII", data, 0x1C, 16, 3, 1, 8)
        for base in (0x2C, 0x64):
            struct.pack_into("<14I", data, base, 56, 0xFFFFFFFF, 0xFFFFFFFF, 0xFF, 0xFFFF, 0xFFFF, 0xFF, 0xFF, 0xFFFF, 0xFFFF, 0xFF, 0xFF, 32, 32)
        struct.pack_into("<IIIIIIII", data, 0x9C, 0x0700, 0x0700, 0, 0xFFFF, 1, 1, 2048, 2048)
        struct.pack_into("<IIII", data, 0xD0, 2048, 2048, 1, 0)
        return bytes(data)

    # DirectInput --------------------------------------------------------------------------------------------------

    def DirectInput_CreateDevice(self, this, record, argument):
        first_word = self.machine.read_u32(argument(1))
        device_type = {0x6F1D2B61: "keyboard", 0x6F1D2B60: "mouse"}.get(first_word)
        if device_type is None:
            raise RuntimeError(f"DirectInput device {first_word:08x}")
        self.machine.write_u32(argument(2), self.create("DirectInputDevice", device_type=device_type))
        return S_OK

    def DirectInput_EnumDevices(self, this, record, argument):
        return S_OK

    def DirectInputDevice_GetDeviceState(self, this, record, argument):
        self.machine.write_bytes(argument(2), bytes(argument(1)))
        return S_OK

    def DirectInputDevice_GetDeviceData(self, this, record, argument):
        queue = self.input_queues.setdefault(record["device_type"], [])
        capacity = self.machine.read_u32(argument(3))
        count = min(capacity, len(queue))
        timestamp = self.machine.operating_system.now_milliseconds
        for index in range(count):
            offset, data = queue[index]
            self.machine.write_bytes(argument(2) + 16 * index, struct.pack("<IIII", offset, data, timestamp, 0))
        if not argument(4) & 1:
            del queue[:count]
        self.machine.write_u32(argument(3), count)
        return S_OK

    def send_key(self, scan_code: int, is_pressed: bool) -> None:
        self.input_queues.setdefault("keyboard", []).append((scan_code, 0x80 if is_pressed else 0))

    # Shared IUnknown ----------------------------------------------------------------------------------------------

    def any_AddRef(self, this, record, argument):
        record["references"] += 1
        return record["references"]

    def any_Release(self, this, record, argument):
        record["references"] -= 1
        return max(record["references"], 0)

    def any_QueryInterface(self, this, record, argument):
        first_word = self.machine.read_u32(argument(1))
        kind = INTERFACE_IDENTIFIERS.get(first_word)
        if kind is None:
            raise RuntimeError(f"QueryInterface for unknown interface {first_word:08x} on {record['kind']}")
        if kind not in INTERFACES:
            raise RuntimeError(f"QueryInterface for {kind} has no method table")
        inherited = {key: value for key, value in record.items() if key in ("device_type",)}
        self.machine.write_u32(argument(2), self.create(kind, parent=this, **inherited))
        return S_OK


def register_com_stubs(machine) -> None:
    world = machine.com = ComWorld(machine)

    def stdcall(name, count):
        def decorate(function):
            function.callee_cleanup_bytes = count * 4
            machine.handlers[name] = function
            return function

        return decorate

    def plain(name, count):
        def decorate(function):
            machine.handlers[name] = lambda context, argument: StubResult(
                integer=function(argument) or 0, callee_cleanup_bytes=count * 4
            )
            return function

        return decorate

    @stdcall("DirectDrawEnumerateA", 2)
    def enumerate_drivers(context, argument):
        description = machine.new_c_string("Primary Display Driver")
        name = machine.new_c_string("display")
        yield argument(0), [0, description, name, argument(1)]
        return S_OK

    @plain("DirectDrawCreate", 3)
    def create_direct_draw(argument):
        machine.write_u32(argument(1), world.create("DirectDraw"))
        return S_OK

    @plain("DirectInputCreateA", 4)
    def create_direct_input(argument):
        machine.write_u32(argument(2), world.create("DirectInput"))
        return S_OK

    @plain("DirectDrawCreateClipper", 3)
    def create_clipper(argument):
        machine.write_u32(argument(1), world.create("Clipper"))
        return S_OK

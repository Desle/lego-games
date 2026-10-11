"""Fake DirectDraw surfaces and Direct3D objects: surfaces have memory, everything else only answers."""

import struct

S_OK = 0
E_FAIL = 0x80004005

DDSD_PIXELFORMAT = 0x1000
DDSCAPS_BACKBUFFER = 0x4
DDSCAPS_COMPLEX = 0x8
DDSCAPS_FLIP = 0x10
DDSCAPS_PRIMARYSURFACE = 0x200
DDSCAPS_TEXTURE = 0x1000
DDSCAPS_ZBUFFER = 0x20000

DISPLAY_WIDTH = 640
DISPLAY_HEIGHT = 480
DISPLAY_FORMAT = struct.pack("<IIIIIIII", 32, 0x40, 0, 16, 0xF800, 0x07E0, 0x001F, 0)


class DisplayMethods:
    # Surfaces -----------------------------------------------------------------------------------------------------

    def create_surface(self, description: bytes, kind: str = "Surface4", capabilities_override: int = None) -> int:
        size = len(description)
        flags, height, width = struct.unpack_from("<III", description, 4)
        capabilities = struct.unpack_from("<I", description, 0x68)[0] if capabilities_override is None else capabilities_override
        if flags & DDSD_PIXELFORMAT:
            pixel_format = bytes(description[0x48:0x68])
        else:
            pixel_format = DISPLAY_FORMAT
        if capabilities & (DDSCAPS_PRIMARYSURFACE | DDSCAPS_BACKBUFFER):
            width, height = DISPLAY_WIDTH, DISPLAY_HEIGHT
        bits_per_pixel = struct.unpack_from("<I", pixel_format, 0x0C)[0] or 16
        pitch = (width * max(bits_per_pixel // 8, 1) + 3) & ~3
        address = self.create(
            kind,
            width=width,
            height=height,
            capabilities=capabilities,
            pixel_format=pixel_format,
            pitch=pitch,
            memory=0,
            attached=[],
            description_size=size,
            flags=flags,
        )
        return address

    def surface_memory(self, record) -> int:
        if record["memory"] == 0:
            record["memory"] = self.machine.allocate_heap(max(record["pitch"] * max(record["height"], 1), 16), 16)
        return record["memory"]

    def fill_surface_description(self, record, pointer: int, with_memory: bool) -> None:
        size = self.machine.read_u32(pointer)
        data = bytearray(size)
        flags = 0x1 | 0x2 | 0x4 | 0x8 | 0x1000
        struct.pack_into("<IIIII", data, 0, size, flags, record["height"], record["width"], record["pitch"])
        if with_memory:
            struct.pack_into("<I", data, 0x24, self.surface_memory(record))
        data[0x48:0x68] = record["pixel_format"]
        struct.pack_into("<I", data, 0x68, record["capabilities"])
        self.machine.write_bytes(pointer, bytes(data))

    def any_CreateSurface(self, this, record, argument):
        description = self.machine.read_bytes(argument(1), self.machine.read_u32(argument(1)))
        flags = struct.unpack_from("<I", description, 4)[0]
        surface_address = self.create_surface(description)
        surface = self.object_kinds[surface_address]
        if surface["capabilities"] & DDSCAPS_PRIMARYSURFACE and flags & 0x20:
            back_count = struct.unpack_from("<I", description, 0x14)[0]
            for _ in range(back_count):
                back = self.create_surface(description, capabilities_override=DDSCAPS_BACKBUFFER | 0x2000)
                surface["attached"].append(back)
        self.machine.write_u32(argument(2), surface_address)
        return S_OK

    def any_GetAttachedSurface(self, this, record, argument):
        capabilities = self.machine.read_u32(argument(1))
        for candidate in record["attached"]:
            if self.object_kinds[candidate]["capabilities"] & capabilities:
                self.machine.write_u32(argument(2), candidate)
                return S_OK
        if capabilities & DDSCAPS_ZBUFFER:
            for candidate in record["attached"]:
                if self.object_kinds[candidate]["capabilities"] & DDSCAPS_ZBUFFER:
                    self.machine.write_u32(argument(2), candidate)
                    return S_OK
        return 0x887602C1

    def any_AddAttachedSurface(self, this, record, argument):
        record["attached"].append(argument(1))
        return S_OK

    def any_Lock(self, this, record, argument):
        self.fill_surface_description(record, argument(2), with_memory=True)
        return S_OK

    def any_GetSurfaceDesc(self, this, record, argument):
        self.fill_surface_description(record, argument(1), with_memory=False)
        return S_OK

    def any_GetPixelFormat(self, this, record, argument):
        self.machine.write_bytes(argument(1), record["pixel_format"])
        return S_OK

    def any_GetCaps(self, this, record, argument):
        if record["kind"].startswith("Surface"):
            self.machine.write_u32(argument(1), record["capabilities"])
        else:
            raise RuntimeError(f"GetCaps on {record['kind']}")
        return S_OK

    def any_GetDC(self, this, record, argument):
        self.machine.write_u32(argument(1), 0x2000)
        return S_OK

    def any_IsLost(self, this, record, argument):
        return S_OK

    def any_GetDDInterface(self, this, record, argument):
        self.machine.write_u32(argument(1), self.create("DirectDraw4"))
        return S_OK

    # Direct3D -----------------------------------------------------------------------------------------------------

    def any_CreateDevice(self, this, record, argument):
        self.machine.write_u32(argument(3), self.create("Direct3DDevice3", target=argument(2)))
        return S_OK

    def any_CreateViewport(self, this, record, argument):
        self.machine.write_u32(argument(1), self.create("Direct3DViewport3"))
        return S_OK

    def any_CreateMaterial(self, this, record, argument):
        self.machine.write_u32(argument(1), self.create("Direct3DMaterial3"))
        return S_OK

    def any_CreateLight(self, this, record, argument):
        self.machine.write_u32(argument(1), self.create("Direct3DLight"))
        return S_OK

    def any_GetHandle(self, this, record, argument):
        record.setdefault("handle", 0)
        self.__dict__.setdefault("handle_counter", 0x100)
        self.handle_counter += 1
        record["handle"] = self.handle_counter
        self.machine.write_u32(argument(2), record["handle"])
        return S_OK

    def Direct3DDevice3_EnumTextureFormats(self, this, record, argument):
        formats = [
            struct.pack("<IIIIIIII", 32, 0x40, 0, 16, 0xF800, 0x07E0, 0x001F, 0),
            struct.pack("<IIIIIIII", 32, 0x41, 0, 16, 0x7C00, 0x03E0, 0x001F, 0x8000),
            struct.pack("<IIIIIIII", 32, 0x41, 0, 16, 0x0F00, 0x00F0, 0x000F, 0xF000),
            struct.pack("<IIIIIIII", 32, 0x41, 0, 32, 0x00FF0000, 0x0000FF00, 0x000000FF, 0xFF000000),
        ]
        for pixel_format in formats:
            address = self.machine.allocate_heap(32, 16)
            self.machine.write_bytes(address, pixel_format)
            yield argument(1), [address, argument(2)]
        return S_OK

    def Direct3DDevice3_GetCaps(self, this, record, argument):
        self.machine.write_bytes(argument(1), self.device_description(True))
        self.machine.write_bytes(argument(2), self.device_description(False))
        return S_OK

    Direct3DDevice2_GetCaps = Direct3DDevice3_GetCaps

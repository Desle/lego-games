"""Records what the original hands Direct3D 3: every draw with its vertices, texture and render state, frame by frame.

GolDP.dll transforms on the CPU (FUN_1000d760 and its siblings): the vertices reach `DrawIndexedPrimitive` already in screen space
(FVF 0x1c4 = XYZRHW | DIFFUSE | SPECULAR | TEX1, 32 bytes: sx, sy, sz, rhw, diffuse, specular, u, v) and back faces are dropped before the
call (FUN_1000ebd0). The model-to-clip matrix of the draw is read from the Gol device (+0xc8490) for the camera comparison.
"""

import base64
import hashlib
import struct

from unicorn.x86_const import UC_X86_REG_ECX

DEVICE_MATRIX_OFFSET = 0xC8490
DEVICE_MODEL_OFFSET = 0xC8518
DEVICE_SCALE_OFFSET = 0xC8400
# Slots FUN_10012f50 fills with the transform variant (+0xc8764) and the culling draw (+0xc8768).
DEVICE_TRANSFORM_OFFSET = 0xC8764
# Transform variants whose matrix is clip-style: the pixel is x/w * scale + offset (device +0xc8400), applied after the divide.
SCALED_TRANSFORMS = (0x1000C630, 0x1000CAF0, 0x1000CD20)
# The per-variant draw functions of GolDP.dll (FUN_10012f50 selects one); each is entered with the Gol device in ecx.
DRAW_FUNCTION_ADDRESSES = (0x1000EBD0, 0x1000ECE0, 0x1000EDF0, 0x10010330, 0x10010500, 0x100106D0, 0x1000EB90)
VERTEX_STRIDE = 32


def encode(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


class RenderRecorder:
    def __init__(self, machine, emit):
        self.machine = machine
        self.emit = emit
        self.device = 0
        self.current_texture = None
        self.frame = -1
        self.is_recording = False
        self.events = []
        self.render_states = {}
        self.stage_states = {}
        self.textures = {}
        self.sent_textures = set()
        self.state_table = []
        self.state_index = {}
        self.material_colors = {}

    # Installation --------------------------------------------------------------------------------------------------

    def install(self) -> None:
        world = self.machine.com
        for method, count in (
            ("SetRenderState", 2),
            ("SetTexture", 2),
            ("SetTextureStageState", 3),
            ("DrawIndexedPrimitive", 7),
            ("DrawPrimitive", 5),
        ):
            setattr(world, f"Direct3DDevice3_{method}", getattr(self, f"on_{method}"))
        world.Direct3DViewport3_SetViewport2 = self.on_SetViewport2
        world.Direct3DViewport3_Clear2 = self.on_Clear2
        world.Direct3DMaterial3_SetMaterial = self.on_SetMaterial
        for address in DRAW_FUNCTION_ADDRESSES:
            self.machine.add_address_hook(address, self.on_draw_function)

    def on_draw_function(self) -> None:
        self.device = self.machine.uc.reg_read(UC_X86_REG_ECX)

    def begin_frame(self, frame: int) -> None:
        self.frame = frame
        self.events = []

    def end_frame(self) -> None:
        if self.frame >= 0 and self.is_recording:
            self.emit({"type": "render_frame", "frame": self.frame, "events": self.events, "states": self.state_table})
        self.events = []
        self.state_table = []
        self.state_index = {}

    # State ---------------------------------------------------------------------------------------------------------

    def current_state(self) -> int:
        key = (tuple(sorted(self.render_states.items())), tuple(sorted(self.stage_states.items())))
        if key not in self.state_index:
            self.state_index[key] = len(self.state_table)
            self.state_table.append(
                {
                    "render": {str(name): value for name, value in key[0]},
                    "stage": {f"{stage}.{kind}": value for (stage, kind), value in key[1]},
                }
            )
        return self.state_index[key]

    def on_SetRenderState(self, this, record, argument):
        self.render_states[argument(1)] = argument(2)
        return 0

    def on_SetTextureStageState(self, this, record, argument):
        self.stage_states[(argument(1), argument(2))] = argument(3)
        return 0

    def on_SetMaterial(self, this, record, argument):
        # D3DMATERIAL: size, diffuse, ambient, specular, emissive (RGBA floats), power, texture handle
        self.material_colors[this] = struct.unpack("<16f", self.machine.read_bytes(argument(1) + 4, 64))
        return 0

    def on_SetViewport2(self, this, record, argument):
        values = struct.unpack("<5I6f", self.machine.read_bytes(argument(1), 44))
        if self.is_recording:
            self.events.append({"kind": "viewport", "x": values[1], "y": values[2], "width": values[3], "height": values[4], "clip": list(values[5:])})
        return 0

    def on_Clear2(self, this, record, argument):
        if self.is_recording:
            self.events.append({"kind": "clear", "flags": argument(2), "color": argument(3), "depth": struct.unpack("<f", struct.pack("<I", argument(4)))[0]})
        return 0

    def on_SetTexture(self, this, record, argument):
        texture = argument(2)
        self.current_texture = self.describe_texture(texture)
        return 0

    # Textures ------------------------------------------------------------------------------------------------------

    def describe_texture(self, texture_pointer: int):
        """The hash of the pixels of the surface behind a texture object (sent once), or None."""
        if texture_pointer == 0:
            return None
        world = self.machine.com
        record = world.object_kinds.get(texture_pointer)
        surface = world.object_kinds.get(record.get("parent")) if record else None
        if surface is None or surface.get("memory", 0) == 0:
            return None
        size = surface["pitch"] * surface["height"]
        pixels = self.machine.read_bytes(surface["memory"], size)
        digest = hashlib.sha1(pixels).hexdigest()[:16]
        if digest not in self.sent_textures:
            self.sent_textures.add(digest)
            pixel_format = struct.unpack("<8I", surface["pixel_format"])
            self.emit(
                {
                    "type": "texture",
                    "hash": digest,
                    "width": surface["width"],
                    "height": surface["height"],
                    "pitch": surface["pitch"],
                    "bitsPerPixel": pixel_format[3],
                    "masks": list(pixel_format[4:8]),
                    "pixels": encode(pixels),
                }
            )
        return digest

    # Draws ---------------------------------------------------------------------------------------------------------

    def device_matrices(self) -> dict:
        if self.device == 0:
            return {}
        read = self.machine.read_bytes
        matrix_pointer = self.machine.read_u32(self.device + DEVICE_MATRIX_OFFSET)
        model_pointer = self.machine.read_u32(self.device + DEVICE_MODEL_OFFSET)
        result = {
            "scale": list(struct.unpack("<4f", read(self.device + DEVICE_SCALE_OFFSET, 16))),
            "transform": self.machine.read_u32(self.device + DEVICE_TRANSFORM_OFFSET),
            "cull": self.machine.read_u32(self.device + DEVICE_TRANSFORM_OFFSET + 4),
        }
        if matrix_pointer:
            result["clip"] = list(struct.unpack("<16f", read(matrix_pointer, 64)))
        if model_pointer:
            matrix = list(struct.unpack("<16f", read(model_pointer, 64)))
            if result["transform"] in SCALED_TRANSFORMS:
                scale_x, scale_y, offset_x, offset_y = result["scale"]
                for row in range(4):
                    x, y, w = matrix[4 * row], matrix[4 * row + 1], matrix[4 * row + 3]
                    matrix[4 * row] = x * scale_x + w * offset_x
                    matrix[4 * row + 1] = y * scale_y + w * offset_y
            result["model"] = matrix
        return result

    def record_draw(self, indexed: bool, argument) -> None:
        if not self.is_recording:
            return
        primitive, fvf, vertices, vertex_count = argument(1), argument(2), argument(3), argument(4)
        event = {
            "kind": "draw",
            "primitive": primitive,
            "fvf": fvf,
            "state": self.current_state(),
            "texture": self.current_texture,
            "vertices": encode(self.machine.read_bytes(vertices, vertex_count * self.vertex_size(fvf))),
            "vertexCount": vertex_count,
            **self.device_matrices(),
        }
        if indexed:
            index_count = argument(6)
            event["indices"] = encode(self.machine.read_bytes(argument(5), index_count * 2))
            event["indexCount"] = index_count
        self.events.append(event)

    @staticmethod
    def vertex_size(fvf: int) -> int:
        size = 0
        if fvf & 0x4:
            size += 16
        elif fvf & 0x2:
            size += 12
        if fvf & 0x10:
            size += 12
        if fvf & 0x40:
            size += 4
        if fvf & 0x80:
            size += 4
        size += 8 * ((fvf >> 8) & 0xF)
        return size

    def on_DrawIndexedPrimitive(self, this, record, argument):
        self.record_draw(True, argument)
        return 0

    def on_DrawPrimitive(self, this, record, argument):
        self.record_draw(False, argument)
        return 0

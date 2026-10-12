"""Records the triangles the original's decals hold: every projection (0x00414a30) refills the decal object with the
triangles 0x00415810 adds, whatever the camera sees.

A frame's record lists the decals that were drawn (0x00415a40) while holding triangles (flag 4 at +0x100), with the
address the last projection was called from, which tells the decal's kind (oil slick 0x004575a3, explosion scar 0x004218f5 and 0x004219c9, crane shadow
0x00490441 (the crane's draw distance is opened), car shadow 0x0043fbaf, skid trail 0x00491ebf).
"""

import struct

from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP

PROJECT = 0x00414A30
ADD_TRIANGLE = 0x00415810
DRAW = 0x00415A40
CRANE_UPDATE = 0x00490190
CRANE_SHADOW = 0x00490330
CRANE_FIGURE_OFFSET = 0x38
DRAW_DISTANCE_OFFSET = 0x84
UNLIMITED_SQUARED_DISTANCE = 1e12
FLAGS_OFFSET = 0x100
HAS_TRIANGLES_FLAG = 4
POSITION_OFFSET = 0xE8


class DecalRecorder:
    is_always_recording = False

    def __init__(self, machine, emit):
        self.machine = machine
        self.emit = emit
        self.frame = -1
        self.is_recording = False
        self.decals = {}
        self.drawn = set()

    def install(self) -> None:
        self.machine.add_address_hook(PROJECT, self.on_project)
        self.machine.add_address_hook(ADD_TRIANGLE, self.on_add_triangle)
        self.machine.add_address_hook(DRAW, self.on_draw)
        self.machine.add_address_hook(CRANE_UPDATE, self.on_crane)
        self.machine.add_address_hook(CRANE_SHADOW, self.on_crane)

    def begin_frame(self, frame: int) -> None:
        self.frame = frame

    def end_frame(self) -> None:
        drawn, self.drawn = self.drawn, set()
        if not self.is_recording or self.frame < 0:
            return
        decals = []
        for decal, held in self.decals.items():
            if decal not in drawn:
                continue
            flags = self.machine.read_u32(decal + FLAGS_OFFSET)
            if not flags & HAS_TRIANGLES_FLAG:
                continue
            # An explosion owns its scar at +0xe4: its state is at +0x04 and the scar's alpha at +0x23c.
            alpha = struct.unpack("<f", self.machine.read_bytes(decal + 0x158, 4))[0]
            decals.append(
                {
                    "decal": decal,
                    "source": held["source"],
                    "triangles": held["triangles"],
                    "ownerState": self.machine.read_u32(decal - 0xE0),
                    "ownerAlpha": alpha,
                    "position": list(struct.unpack("<3f", self.machine.read_bytes(decal + POSITION_OFFSET, 12))),
                }
            )
        self.emit({"type": "decal_frame", "frame": self.frame, "decals": decals})

    def on_crane(self) -> None:
        # The camera never passes a crane in the scenarios: opening the instance's draw distance (+0x84) makes the crane
        # pose and shadow its nearest level as it does when the camera is near.
        crane = self.machine.uc.reg_read(UC_X86_REG_ECX)
        figure = self.machine.read_u32(crane + CRANE_FIGURE_OFFSET)
        if figure != 0:
            self.machine.write_bytes(figure + DRAW_DISTANCE_OFFSET, struct.pack("<f", UNLIMITED_SQUARED_DISTANCE))

    def on_project(self) -> None:
        esp = self.machine.uc.reg_read(UC_X86_REG_ESP)
        decal = self.machine.uc.reg_read(UC_X86_REG_ECX)
        self.decals[decal] = {"source": self.machine.read_u32(esp), "triangles": []}

    def on_draw(self) -> None:
        self.drawn.add(self.machine.uc.reg_read(UC_X86_REG_ECX))

    def on_add_triangle(self) -> None:
        esp = self.machine.uc.reg_read(UC_X86_REG_ESP)
        decal = self.machine.uc.reg_read(UC_X86_REG_ECX)
        held = self.decals.get(decal)
        if held is None:
            return
        held["triangles"].append(
            [list(struct.unpack("<5f", self.machine.read_bytes(self.machine.read_u32(esp + 4 * index), 20))) for index in (1, 2, 3)]
        )

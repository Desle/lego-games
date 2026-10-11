"""The computer racers' state for the golden trace: route follower, scripted car body, AI timers and the rubber band."""

import struct

CAR_BODY_OFFSET = 0x3E8
FOLLOWER_OFFSET = CAR_BODY_OFFSET + 0x74C
RUBBER_BAND_OFFSET = 0x284

# (name, offset from the racer, word count); the route pointer (follower +0x28) is skipped
COMPUTER_RACER_FIELDS = (
    ("follower.pose", FOLLOWER_OFFSET + 0x00, 10),
    ("follower.playback", FOLLOWER_OFFSET + 0x2C, 19),
    ("ai.personality", 0xD1C, 2),
    ("ai.timers", 0xD34, 1),
    ("ai.voice", 0xD40, 2),
)


def read_words(machine, address: int, count: int) -> list:
    return list(struct.unpack(f"<{count}I", machine.read_bytes(address, count * 4)))


def snapshot_computer_fields(machine, fields: dict, racers: int, racer_set: int, racer_count: int) -> None:
    for index in range(racer_count):
        racer = racers + 0xE34 * index
        if machine.read_u32(racer + 0xD08) != 2:
            continue
        for name, offset, count in COMPUTER_RACER_FIELDS:
            fields[f"racer{index}.{name}"] = read_words(machine, racer + offset, count)
        fields[f"racer{index}.ai.personality"][1] &= 0xFFFF
    fields["race.rubberBand"] = read_words(machine, racer_set + RUBBER_BAND_OFFSET + 0x08, 2)

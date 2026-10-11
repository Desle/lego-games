"""The race flow and the track logic of the original, read from memory after each frame (see golden_trace.py).

Offsets are the race object's (`Race_Update` 0x00435220): event set +0x2098, hazards +0x2148, timers +0x213c, main
triggers +0x2080, environment triggers +0x2128, worlds +0x390/+0x398/+0x3a4, sky +0x2f90, the registry's time list
(racer set +0xf0 = race +0x4ac, head at +0xc).
"""

import struct

EVENT_SET_OFFSET = 0x2098
HAZARDS_OFFSET = 0x2148
TIMERS_OFFSET = 0x213C
MAIN_TRIGGERS_OFFSET = 0x2080
ENVIRONMENT_TRIGGERS_OFFSET = 0x2128
SKY_OFFSET = 0x2F90
TIME_LIST_OFFSET = 0x4AC + 0xC
# Instance flag bits the port does not model: 0x8 (fade distances, 0x10028110) and 0x200000 (presentation).
PRESENTATION_FLAGS = 0x200008
WORLD_OFFSETS = (("track", 0x390), ("blended", 0x398), ("local", 0x3A4))

# (name, array offset, count offset, stride, extra word offsets read from the element, byte offsets read as one word)
EVENT_CLASSES = (
    ("2a", 0x5C, 0x28, 0x5C, (0x58,), ()),
    ("28", 0x60, 0x2C, 0x34, (), ()),
    ("29", 0x64, 0x30, 0x34, (), ()),
    ("3d", 0x68, 0x34, 0x64, (), ()),
    ("42", 0x70, 0x3C, 0x34, (), ()),
    ("4b", 0x74, 0x40, 0x30, (0x28,), (0x2C,)),
    ("52", 0x78, 0x4C, 0x2C, (), ()),
    ("4d", 0x7C, 0x44, 0x48, (), ()),
    ("51", 0x80, 0x48, 0x24, (), ()),
    ("53", 0x84, 0x50, 0x34, (), ()),
    ("55", 0x88, 0x54, 0x2C, (), ()),
    ("59", 0x8C, 0x58, 0x38, (), (0x34,)),
)


def read_words(machine, address: int, count: int) -> list:
    return list(struct.unpack(f"<{count}I", machine.read_bytes(address, count * 4)))


def read_events(machine, race: int, fields: dict) -> None:
    event_set = race + EVENT_SET_OFFSET
    for name, array_offset, count_offset, stride, word_offsets, byte_offsets in EVENT_CLASSES:
        array = machine.read_u32(event_set + array_offset)
        count = machine.read_u32(event_set + count_offset)
        words = []
        for index in range(count if array != 0 else 0):
            element = array + stride * index
            words += read_words(machine, element + 0x14, 3)
            words += [machine.read_u32(element + offset) for offset in word_offsets]
            words += [machine.read_bytes(element + offset, 1)[0] & 1 for offset in byte_offsets]
        fields[f"track.events.{name}"] = words


def read_hazards(machine, race: int, fields: dict) -> None:
    hazards = race + HAZARDS_OFFSET
    count = machine.read_u32(hazards)
    array = machine.read_u32(hazards + 4)
    words = []
    for index in range(count):
        hazard = machine.read_u32(array + 4 * index)
        words += read_words(machine, hazard + 8, 2)
    fields["track.hazards"] = words


def read_triggers(machine, race: int, fields: dict) -> None:
    main = race + MAIN_TRIGGERS_OFFSET
    main_count = machine.read_u32(main + 0xC)
    main_array = machine.read_u32(main + 0x14)
    words = []
    for index in range(main_count):
        flags, current, previous = read_words(machine, main_array + 0x58 * index + 0x38, 3)
        words += [flags & 3, current, previous]
    fields["track.triggers.main"] = words
    environment = race + ENVIRONMENT_TRIGGERS_OFFSET
    environment_count = machine.read_u32(environment + 0xC)
    environment_array = machine.read_u32(environment + 0x10)
    words = []
    for index in range(environment_count):
        words += [machine.read_u32(environment_array + 0x3C * index + 0x38) & 3]
    fields["track.triggers.environment"] = words


def read_timers(machine, race: int, fields: dict) -> None:
    timers = race + TIMERS_OFFSET
    count = machine.read_u32(timers + 4)
    array = machine.read_u32(timers + 8)
    words = []
    for index in range(count):
        remaining, flags = read_words(machine, array + 0x24 * index + 0x18, 2)
        words += [remaining, flags & 1]
    fields["track.timers"] = words
    words = []
    entry = machine.read_u32(race + TIME_LIST_OFFSET)
    while entry != 0 and len(words) < 4000:
        words += [machine.read_u32(entry + 0x14), machine.read_u32(entry + 0x18)]
        entry = machine.read_u32(entry + 0x28)
    fields["track.timeList"] = words


def read_world(machine, world: int) -> tuple:
    materials = []
    animation_array = machine.read_u32(world + 0x108)
    for index in range(machine.read_u32(world + 0x74)):
        animation = animation_array + 0x14 * index
        entries = machine.read_u32(animation + 0xC)
        for entry_index in range(machine.read_u32(animation + 0x10)):
            entry = entries + 0x18 * entry_index
            materials += [machine.read_u32(entry + 0x14) & 6, machine.read_u32(entry + 0x10)]
    skeletons = []
    skeleton_array = machine.read_u32(world + 0xA0)
    for index in range(machine.read_u32(world + 0x54)):
        instance = skeleton_array + 0xF4 * index
        skeletons += [machine.read_u32(instance + 0x5C) & ~PRESENTATION_FLAGS, machine.read_u32(instance + 0xB4), machine.read_u32(instance + 0xD0)]
        skeletons += [struct.unpack("<H", machine.read_bytes(instance + 0xBC, 2))[0], machine.read_u32(instance + 0xEC)]
        skeletons += read_words(machine, instance + 0x4C, 3)
    return materials, skeletons


def read_worlds(machine, race: int, fields: dict) -> None:
    for name, offset in WORLD_OFFSETS:
        world = machine.read_u32(race + offset)
        if world == 0:
            continue
        materials, skeletons = read_world(machine, world)
        fields[f"track.world.{name}.materials"] = materials
        fields[f"track.world.{name}.skeletons"] = skeletons


def read_sky(machine, race: int, fields: dict) -> None:
    sky = race + SKY_OFFSET
    words = []
    settings = machine.read_u32(sky + 0xA8)
    for index in range(machine.read_u32(sky + 0xB0)):
        words += read_words(machine, settings + 0x10 * index, 2)
    words += read_words(machine, sky + 0xB4, 4)
    fields["track.sky"] = words
    world = machine.read_u32(sky + 0x9C)
    if world != 0:
        materials, skeletons = read_world(machine, world)
        fields["track.world.sky.materials"] = materials
        fields["track.world.sky.skeletons"] = skeletons


def read_race_flow(machine, race: int, racer_count: int, fields: dict) -> None:
    settings = machine.read_u32(race + 4)
    fields["race.finishedCount"] = [machine.read_u32(race + 0x3330)]
    fields["race.isRunning"] = [machine.read_u32(race + 0x3334)]
    fields["race.pauseState"] = [machine.read_u32(race + 0x30C0)]
    fields["race.unidentifiedCountdown"] = [machine.read_u32(race + 0x334C)]
    fields["race.placements"] = [struct.unpack("<h", machine.read_bytes(settings + 0x15E + 0x5C * index, 2))[0] & 0xFFFF for index in range(racer_count)]


def read_racer_flow(machine, race: int, racer_count: int, fields: dict) -> None:
    racers = machine.read_u32(race + 0x3BC + 0x140)
    for index in range(racer_count):
        racer = racers + 0xE34 * index
        fields[f"racer{index}.flow.lapCount"] = [machine.read_bytes(racer + 0xCE0, 1)[0]]
        fields[f"racer{index}.flow.lapTimes"] = read_words(machine, racer + 0xCEC, 5)
        fields[f"racer{index}.flow.countdowns"] = read_words(machine, racer + 0xD74, 5)


def snapshot_track_fields(machine, race: int, racer_count: int) -> dict:
    fields = {}
    read_events(machine, race, fields)
    read_hazards(machine, race, fields)
    read_triggers(machine, race, fields)
    read_timers(machine, race, fields)
    read_worlds(machine, race, fields)
    read_sky(machine, race, fields)
    read_race_flow(machine, race, racer_count, fields)
    read_racer_flow(machine, race, racer_count, fields)
    return fields

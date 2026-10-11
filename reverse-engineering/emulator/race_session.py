"""Builds the game settings block a race needs, starts the real race session and steps the real race loop frame by frame."""

import struct

APPLICATION = 0x004C4A38
SETTINGS = APPLICATION + 0xABC
SESSION_GLOBAL = 0x004C4914
RANDOM_CURSOR = 0x004C6EE4
RACE_SESSION_CONSTRUCTOR = 0x0042C1B0
RACE_SESSION_BEGIN = 0x0042C280
RACE_RUN_LOOP = 0x00432540
PUMP_MESSAGES = 0x00416EF0
RACE_SESSION_SIZE = 0x37B8
RACE_OFFSET_IN_SESSION = 0x26 * 4

SLOT_STRIDE = 0x5C
SLOT_BASE = 0x104
CONTROL_BASE = 0x348
CONTROL_STRIDE = 0x28
DEFAULT_KEY_CODES = (0xCB, 0xCD, 0xC8, 0xD0, 0x1C, 0x9D, 0x32, 0x39, 0xB8)


def write_text(machine, address: int, text: str, size: int) -> None:
    machine.write_bytes(address, text.encode("latin-1")[: size - 1].ljust(size, b"\0"))


def write_float(machine, address: int, value: float) -> None:
    machine.write_bytes(address, struct.pack("<f", value))


def fill_settings(machine, scenario: dict) -> None:
    local_players = scenario.get("localPlayerCount", 1)
    codes = scenario["racerCodes"]
    racer_count = min(scenario.get("racerCount", 6), len(codes))
    racer_count = max(racer_count, local_players)
    machine.write_u32(SETTINGS + 0x20, scenario.get("raceModeFlags", 0))
    machine.write_u32(SETTINGS + 0x24, 1)
    machine.write_u32(SETTINGS + 0x2C, scenario.get("multiplayerLapCount", 3))
    machine.write_u32(SETTINGS + 0x38, 1)
    machine.write_u32(SETTINGS + 0x3C, 1 if scenario.get("isMirrored", False) else 0)
    write_text(machine, SETTINGS + 0x2D, scenario.get("circuit", "c1"), 3)
    write_text(machine, SETTINGS + 0x48, scenario["raceFolder"].lower(), 9)
    machine.write_u32(SETTINGS + 0x100, racer_count)
    for index in range(racer_count):
        slot = SETTINGS + SLOT_BASE + SLOT_STRIDE * index
        machine.write_bytes(slot, bytes(SLOT_STRIDE))
        write_text(machine, slot, codes[index], 8)
        machine.write_u32(slot + 0x10, 0 if index < local_players else 2)
    machine.write_u32(SETTINGS + 0x32C, local_players)
    for player in range(local_players):
        base = SETTINGS + CONTROL_BASE + CONTROL_STRIDE * player
        machine.write_bytes(base, bytes(CONTROL_STRIDE))
        machine.write_bytes(base, bytes([3]))
        for binding, scan_code in enumerate(DEFAULT_KEY_CODES):
            machine.write_u32(base + 4 + 4 * binding, 0x10000000 | scan_code)


def begin_race(machine, scenario: dict) -> int:
    """Runs the race session's construction and RaceSession_Begin (the race description and every loader); returns the race object."""
    fill_settings(machine, scenario)
    machine.write_u32(RANDOM_CURSOR, scenario.get("randomPosition", 0))
    session = machine.allocate_heap(RACE_SESSION_SIZE, 16)
    machine.call_function(RACE_SESSION_CONSTRUCTOR, "thiscall", [session])
    machine.write_u32(SESSION_GLOBAL, session)
    machine.call_function(RACE_SESSION_BEGIN, "thiscall", [session, SETTINGS])
    return session + RACE_OFFSET_IN_SESSION

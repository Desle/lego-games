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
DEFAULT_BINDING_TABLE = 0x004B0624


def write_text(machine, address: int, text: str, size: int) -> None:
    machine.write_bytes(address, text.encode("latin-1")[: size - 1].ljust(size, b"\0"))


def write_float(machine, address: int, value: float) -> None:
    machine.write_bytes(address, struct.pack("<f", value))


JOYSTICK_KIND = 4
GAMEPAD_SUB_TYPE = 4
STEERING_AXIS_CODES = (0x40000001, 0x40000000)
JOYSTICK_BUTTON_CODE = 0x30000000


def fill_joystick_controls(machine, base: int) -> None:
    """The slot Controls_SetDefaults (0x0042e960) makes for a gamepad: the kind, its sub type, the device index, the two steering
    axes and buttons 0 to 6 for the other bindings."""
    machine.write_bytes(base, bytes([JOYSTICK_KIND, GAMEPAD_SUB_TYPE, 0]))
    codes = list(STEERING_AXIS_CODES) + [JOYSTICK_BUTTON_CODE | button for button in range(7)]
    for binding, code in enumerate(codes):
        machine.write_u32(base + 4 + 4 * binding, code)


def fill_settings(machine, scenario: dict) -> None:
    local_players = scenario.get("localPlayerCount", 1)
    codes = scenario["racerCodes"]
    racer_count = min(scenario.get("racerCount", 6), len(codes))
    racer_count = max(racer_count, local_players)
    machine.write_u32(SETTINGS + 0x20, scenario.get("raceModeFlags", 0))
    machine.write_u32(SETTINGS + 0x24, 2 if scenario.get("isTimeTrial", False) else 1)
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
        if scenario.get("controller", "keyboard") == "joystick" and player == 0:
            fill_joystick_controls(machine, base)
            continue
        machine.write_bytes(base, bytes([3]))
        for binding in range(9):
            machine.write_u32(base + 4 + 4 * binding, machine.read_u32(DEFAULT_BINDING_TABLE + 4 * binding))


def begin_race(machine, scenario: dict) -> int:
    """Runs the race session's construction and RaceSession_Begin (the race description and every loader); returns the race object."""
    fill_settings(machine, scenario)
    machine.write_u32(RANDOM_CURSOR, scenario.get("randomPosition", 0))
    session = machine.allocate_heap(RACE_SESSION_SIZE, 16)
    machine.call_function(RACE_SESSION_CONSTRUCTOR, "thiscall", [session])
    machine.write_u32(SESSION_GLOBAL, session)
    machine.call_function(RACE_SESSION_BEGIN, "thiscall", [session, SETTINGS])
    return session + RACE_OFFSET_IN_SESSION

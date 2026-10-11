"""Boots the game the way the C runtime and Windows would, up to the point the caller asks for."""

import os
import struct

from machine import GameMachine

DEFAULT_GAME_FILES = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "original-files", "Lego_Racers_Win_Files_EN", "Game Files"
)

STATIC_INITIALISER_TABLES = ((0x004BE07C, 0x004BE080), (0x004BE000, 0x004BE078))
WIN_MAIN = 0x00449D50
GAME_APPLICATION_RUN = 0x0042BC40
GAME_APPLICATION_RUN_FRONT_END = 0x0042BDC0


def create_machine(options: dict = None) -> GameMachine:
    game_files = os.environ.get("LEGO_RACERS_GAME_FILES", DEFAULT_GAME_FILES)
    return GameMachine(game_files, {"fpu": "auto", "command_line": "LEGORacers.exe -novideo", **(options or {})})


def run_static_initialisers(machine: GameMachine) -> None:
    for start, end in STATIC_INITIALISER_TABLES:
        for address in range(start, end, 4):
            function = machine.read_u32(address)
            if function != 0:
                machine.call_function(function, "cdecl", [])


def run_dll_entry(machine: GameMachine) -> None:
    dll = machine.images[1]
    machine.call_function(dll.entry_point, "stdcall", [dll.image_base, 1, 0])


def boot_to_front_end(machine: GameMachine) -> None:
    """DLL entry, static constructors, WinMain; stops when GameApplication_Run reaches the front end loop."""
    run_dll_entry(machine)
    run_static_initialisers(machine)
    command_line = machine.new_c_string("-novideo")
    machine.write_u32(machine.data_cells["_acmdln"], machine.new_c_string("LEGORacers.exe -novideo"))
    machine.add_address_hook(GAME_APPLICATION_RUN_FRONT_END, lambda: machine.request_stop("front end"))
    machine.prepare_call("stdcall", [0x400000, 0, command_line])
    reason = machine.run(WIN_MAIN)
    if reason != "front end":
        raise RuntimeError(f"WinMain ended with {reason}")

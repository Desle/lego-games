"""JSON-lines bridge: one request per stdin line, one result per stdout line.

Requests (all numbers are unsigned 32-bit integers, floats are passed as their IEEE bit patterns):
  {"id": 1, "op": "call", "address": 4600000, "convention": "cdecl", "precision": "single",
   "arguments": [1, {"buffer": "input"}], "buffers": [{"name": "input", "words": [..], "isRead": true}, {"name": "out", "size": 12, "isRead": true}]}
  {"id": 2, "op": "batch", "calls": [<call>, ...]}   results come back in the same order
  {"id": 3, "op": "ping"}
Failures answer {"id": n, "error": "message"}.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from emulator import Emulator  # noqa: E402

DEFAULT_GAME_FILES = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "original-files", "Lego_Racers_Win_Files_EN", "Game Files"
)


def run_call(emulator: Emulator, request: dict) -> dict:
    return emulator.call(
        request["address"],
        request.get("convention", "cdecl"),
        request.get("arguments", []),
        request.get("precision", "single"),
        request.get("buffers", []),
        request.get("reads", []),
    )


def handle(emulator: Emulator, request: dict) -> dict:
    operation = request["op"]
    if operation == "ping":
        return {"pong": True}
    if operation == "call":
        return run_call(emulator, request)
    if operation == "batch":
        return {"results": [run_call(emulator, call) for call in request["calls"]]}
    raise ValueError(f"unknown op {operation}")


def main() -> None:
    game_files = os.environ.get("LEGO_RACERS_GAME_FILES", DEFAULT_GAME_FILES)
    emulator = Emulator(game_files)
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        try:
            response = {"id": request.get("id"), **handle(emulator, request)}
        except Exception as error:  # noqa: BLE001 - the bridge must report every failure and keep serving
            response = {"id": request.get("id"), "error": f"{type(error).__name__}: {error}"}
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()

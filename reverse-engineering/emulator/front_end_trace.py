"""Runs the original front end (GameApplication_RunFrontEnd 0x0042bdc0) with scripted time and keys and prints what it draws and plays.

Usage: front_end_trace.py <scenario.json>   (or the scenario on stdin)

The scenario is {"frames": [{"dt": milliseconds, "keys": [scan codes pressed this frame]}, ...], "recordFrames": [...], "isRenderRecorded": bool,
"pushScreens": [{"frame": index, "screenId": id}, ...]}; a pushed screen id goes on the screen stack in that frame, as if the top screen had pushed it.
A key in "keys" is pressed for that frame only (a tap): the menus act on key-down events. Output lines are those of presentation_trace.py.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import boot  # noqa: E402
import race_session  # noqa: E402
from audio_trace import AudioRecorder  # noqa: E402
from front_end_stubs import register_front_end_stubs  # noqa: E402
from presentation_trace import emit  # noqa: E402
from render_trace import RenderRecorder  # noqa: E402

SCREEN_STACK_PUSH = 0x0047FA70
# 0x0042d5f4 of the loop 0x0042d510: just before it reads the stack's top again to see whether the screen changed (EDI is the stack).
SCREEN_TOP_RECHECK = 0x0042D5F4
SCREEN_STACK_POP = 0x0047FAA0
APPLICATION_BASE = 0x004C4A38 + 4
LAST_TIME_OFFSET = 0x820


class FrontEndRun:
    def __init__(self, machine, scenario, recorders):
        self.machine = machine
        self.frames = scenario["frames"]
        self.record_frames = scenario.get("recordFrames")
        self.pushes = [dict(entry) for entry in scenario.get("pushScreens", [])]
        self.recorders = recorders
        self.pump_count = 0
        self.screen_events = []

    def on_screen_push(self) -> None:
        from unicorn.x86_const import UC_X86_REG_ESP

        esp = self.machine.uc.reg_read(UC_X86_REG_ESP)
        emit({"type": "screen", "frame": self.pump_count - 1, "kind": "push", "id": self.machine.read_u32(esp + 4) & 0xFFFF})

    def on_top_recheck(self) -> None:
        from unicorn.x86_const import UC_X86_REG_EDI

        frame = self.pump_count - 1
        for entry in self.pushes:
            if entry["frame"] != frame or entry.get("done"):
                continue
            entry["done"] = True
            stack = self.machine.uc.reg_read(UC_X86_REG_EDI)
            array = self.machine.read_u32(stack)
            count = self.machine.read_u32(stack + 8)
            self.machine.uc.mem_write(array + count * 2, int(entry["screenId"]).to_bytes(2, "little"))
            self.machine.write_u32(stack + 8, count + 1)

    def on_screen_pop(self) -> None:
        emit({"type": "screen", "frame": self.pump_count - 1, "kind": "pop", "id": 0})

    def on_pump(self) -> None:
        machine = self.machine
        machine.apply_fpu_option()
        for recorder in self.recorders:
            recorder.end_frame()
        index = self.pump_count
        if index >= len(self.frames):
            machine.request_stop("trace complete")
            return
        frame = self.frames[index]
        for code in frame.get("keys", []):
            machine.com.send_key(code, True)
            machine.com.send_key(code, False)
        state = machine.operating_system
        if index == 0:
            machine.write_u32(APPLICATION_BASE + LAST_TIME_OFFSET, state.now_milliseconds)
        state.now_milliseconds = machine.read_u32(APPLICATION_BASE + LAST_TIME_OFFSET) + frame["dt"]
        self.pump_count += 1
        for recorder in self.recorders:
            recorder.begin_frame(index)
            recorder.is_recording = getattr(recorder, "is_always_recording", False) or self.record_frames is None or index in self.record_frames


def run_scenario(scenario: dict) -> None:
    machine = boot.create_machine({"fpu": "auto"})
    register_front_end_stubs(machine)
    recorders = [AudioRecorder(machine, emit)]
    if scenario.get("isRenderRecorded", True):
        recorders.append(RenderRecorder(machine, emit))
    for recorder in recorders:
        recorder.install()
    boot.boot_to_front_end(machine)
    machine.apply_fpu_option()
    run = FrontEndRun(machine, scenario, recorders)
    machine.add_address_hook(race_session.PUMP_MESSAGES, run.on_pump)
    machine.add_address_hook(SCREEN_STACK_PUSH, run.on_screen_push)
    machine.add_address_hook(SCREEN_STACK_POP, run.on_screen_pop)
    machine.add_address_hook(SCREEN_TOP_RECHECK, run.on_top_recheck)
    reason = machine.resume()
    emit({"type": "done", "reason": reason, "frames": run.pump_count})
    sys.stdout.flush()


def main() -> None:
    source = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
    run_scenario(json.loads(source))


if __name__ == "__main__":
    main()

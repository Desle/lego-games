"""Runs the original race with scripted time and keys and prints what the player sees and hears: the Direct3D draws and the DirectSound calls.

Usage: presentation_trace.py <scenario.json>   (or the scenario on stdin when no path is given)

The scenario is the golden trace's ({"raceFolder", "racerCodes", "racerCount", "localPlayerCount", "circuit", "isMirrored", "fpu", "frames"})
plus "recordFrames": [frame indices whose draws are recorded; absent = all], "isRenderRecorded" and "isAudioRecorded".
One JSON object per line goes to stdout: {"type": "texture" | "render_frame" | "audio_frame" | "done", ...}.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import boot  # noqa: E402
import golden_trace  # noqa: E402
import race_session  # noqa: E402
from audio_trace import AudioRecorder  # noqa: E402
from render_trace import RenderRecorder  # noqa: E402


def emit(record: dict) -> None:
    sys.stdout.write(json.dumps(record, separators=(",", ":")) + "\n")


class PresentationRun(golden_trace.TraceRun):
    """The golden trace's key and clock script without its simulation snapshot; the recorders take the frame boundary instead."""

    def __init__(self, machine, race, scenario, recorders):
        super().__init__(machine, race, scenario)
        self.recorders = recorders
        self.record_frames = scenario.get("recordFrames")
        self.out = open(os.devnull, "w")

    def on_pump(self) -> None:
        index = self.pump_count
        # The draws between pump i-1 and pump i belong to frame i-1.
        for recorder in self.recorders:
            recorder.end_frame()
        super().on_pump()
        if index >= len(self.frames):
            return
        frame = self.pump_count - 1
        for recorder in self.recorders:
            recorder.begin_frame(frame)
            recorder.is_recording = getattr(recorder, "is_always_recording", False) or self.record_frames is None or frame in self.record_frames


def run_scenario(scenario: dict) -> None:
    machine = boot.create_machine({"fpu": scenario.get("fpu", "auto")})
    recorders = []
    if scenario.get("isRenderRecorded", True):
        render = RenderRecorder(machine, emit)
        recorders.append(render)
    if scenario.get("isAudioRecorded", True):
        recorders.append(AudioRecorder(machine, emit))
    for recorder in recorders:
        recorder.install()
    boot.boot_to_front_end(machine)
    machine.apply_fpu_option()
    race = race_session.begin_race(machine, scenario)
    machine.apply_fpu_option()
    limit = golden_trace.read_introduction_camera_limit(machine, race)
    rate = golden_trace.read_introduction_camera_rate(machine, race)
    run = PresentationRun(machine, race, scenario, recorders)
    machine.add_address_hook(race_session.PUMP_MESSAGES, run.on_pump)
    reason = machine.call_function_until_stop(race_session.RACE_RUN_LOOP, "thiscall", [race])
    emit({"type": "done", "reason": reason, "frames": run.pump_count, "introductionCameraLimit": limit, "introductionCameraRate": rate})
    sys.stdout.flush()


def main() -> None:
    source = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
    run_scenario(json.loads(source))


if __name__ == "__main__":
    main()

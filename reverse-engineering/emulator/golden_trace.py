"""Runs the original race frame by frame with scripted time and keys and prints the state of every racer after each frame.

Usage: golden_trace.py <scenario.json>   (or the scenario on stdin when no path is given)

A scenario is {"raceFolder", "racerCodes", "racerCount", "localPlayerCount", "randomPosition", "isMirrored", "raceModeFlags",
"fpu": "auto" | "single" | "double", "frames": [{"dt": milliseconds, "keys": [scan codes held]}, ...]}.
One JSON object per line goes to stdout: {"frame": n, "dt": ..., "fields": {name: [32-bit words]}} and a final {"done": true}.
"""

import json
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from unicorn.x86_const import UC_X86_REG_FPCW  # noqa: E402

import boot  # noqa: E402
import race_session  # noqa: E402
import track_trace  # noqa: E402

APPLICATION_BASE = 0x004C4A38 + 4
LAST_TIME_OFFSET = 0x820
FRAME_DELTA_OFFSET = 0x824
RACER_SET_OFFSET = 0x3BC
CONTROLLER_OFFSET = 0x258
CONTROLLER_STRIDE = 0x74

# (name, offset from the racer, word count)
RACER_FIELDS = (
    ("body.position", 0x3E8 + 0x130, 3),
    ("body.rotation", 0x3E8 + 0x10C, 9),
    ("body.velocity", 0x3E8 + 0x08, 3),
    ("body.centreOfMass", 0x3E8 + 0x20, 3),
    ("body.angularVelocity", 0x3E8 + 0x98, 3),
    ("body.angularMomentum", 0x3E8 + 0xA4, 3),
    ("body.mass", 0x3E8 + 0xC8, 1),
    ("body.groundedWheelCount", 0x3E8 + 0x36C, 1),
    ("body.contact", 0x3E8 + 0x3EC, 1),
    ("body.speed", 0x3E8 + 0x604, 1),
    ("body.forwardSpeed", 0x3E8 + 0x618, 1),
    ("body.throttle", 0x3E8 + 0x628, 1),
    ("body.centripetalForce", 0x3E8 + 0x648, 1),
    ("body.turnRadius", 0x3E8 + 0x64C, 1),
    ("body.yawRate", 0x3E8 + 0x650, 1),
    ("body.flags", 0x3E8 + 0x6C0, 1),
    ("body.travelDirection", 0x3E8 + 0x5F8, 3),
    ("body.heading", 0x3E8 + 0x168, 3),
    ("body.gripScale", 0x3E8 + 0x5F4, 1),
    ("body.steeringScale", 0x3E8 + 0x728, 1),
    ("body.throttleScale", 0x3E8 + 0x72C, 1),
    ("body.topSpeedScale", 0x3E8 + 0x730, 1),
    ("driver.curvature", 0xC70 + 0x0C, 1),
    ("driver.throttle", 0xC70 + 0x10, 1),
    ("driver.flags", 0xC70 + 0x14, 1),
    ("racer.lap", 0xCE4, 1),
    ("racer.crossings", 0xCE8, 1),
    ("racer.flags", 0xD04, 1),
    ("racer.position", 0xD00, 1),
    ("racer.kind", 0xD08, 1),
    ("racer.zones", 0xD0C, 3),
    ("racer.lapNumber", 0xD18, 1),
    ("racer.powerUpChances", 0xD1C, 1),
    ("racer.checkpointSide", 0xCC8, 1),
    ("racer.heldPowerUp", 0xCCC, 1),
    ("racer.powerUpThink", 0xCD8, 2),
    ("racer.turboLevel", 0xD68, 1),
)
# What a computer racer's route-driven body keeps (car body +0x6e8 + racer offset): the follower and the speed state.
COMPUTER_FIELDS = (
    ("ai.held", 0xB30, 1),
    ("ai.follower.position", 0xB34, 3),
    ("ai.follower.speedFactor", 0xB60, 1),
    ("ai.follower.time", 0xB64, 1),
    ("ai.follower.indices", 0xB68, 2),
    ("ai.follower.previousTime", 0xBA8, 1),
    ("ai.bounceOffset", 0xBB0, 3),
    ("ai.targetSpeedFactors", 0xBD0, 2),
    ("ai.flip", 0xBC4, 3),
    ("ai.spin", 0xBBC, 2),
)
COMPUTER_KIND = 2
KIND_OFFSET = 0xD08
CONTROLLER_FIELDS = (
    ("controller.bindings", 0x5C, 1),
    ("controller.state", 0x60, 1),
    ("controller.boostWindow", 0x64, 1),
    ("controller.acceleratingMilliseconds", 0x68, 1),
    ("controller.steering", 0x6C, 1),
)
DISPLAY_FRAME_POINTER_OFFSET = 0x3E8 + 0x13C


def read_words(machine, address: int, count: int) -> list:
    return list(struct.unpack(f"<{count}I", machine.read_bytes(address, count * 4)))


EMITTER_POOLS = (("common", 0x2150), ("track", 0x248C))
EMITTER_INSTANCE_SIZE = 0x18C
EMITTER_HANDLE_COUNT = 100


def snapshot_emitter_pool(machine, pool: int) -> tuple:
    """The instances' state and the taken handles of one emitter pool (Emitters_Load 0x00489af0 layout)."""
    count = machine.read_u32(pool + 0x338)
    instances_address = machine.read_u32(pool + 0xC)
    instance_words = []
    for index in range(count):
        instance = instances_address + EMITTER_INSTANCE_SIZE * index
        definition = machine.read_u32(instance)
        flags = machine.read_bytes(instance + 0xC0, 1)[0] & 0x12
        period = machine.read_u32(definition + 0x14) if definition else 0
        chance_and_priority = (machine.read_u32(definition + 0x18) & 0xFFFF) if definition else 0
        instance_words += [flags, period, chance_and_priority, machine.read_u32(instance + 0x184), machine.read_u32(instance + 0x188), machine.read_u32(instance + 0xF0)]
    handle_words = [0] * 4
    for index in range(EMITTER_HANDLE_COUNT):
        if machine.read_bytes(pool + 0x18 + 8 * index, 1)[0] & 1:
            handle_words[index // 32] |= 1 << (index % 32)
    return instance_words, handle_words


def snapshot_fields(machine, race: int, racer_count: int, local_players: int) -> dict:
    racers = machine.read_u32(race + RACER_SET_OFFSET + 0x140)
    fields = {}
    for index in range(racer_count):
        racer = racers + 0xE34 * index
        for name, offset, count in RACER_FIELDS:
            fields[f"racer{index}.{name}"] = read_words(machine, racer + offset, count)
        if machine.read_u32(racer + KIND_OFFSET) == COMPUTER_KIND:
            for name, offset, count in COMPUTER_FIELDS:
                fields[f"racer{index}.{name}"] = read_words(machine, racer + offset, count)
        display = machine.read_u32(racer + DISPLAY_FRAME_POINTER_OFFSET)
        wheel_words = []
        for wheel in range(4):
            base = racer + 0x3E8 + 0x198 + 0x70 * wheel
            wheel_words += read_words(machine, base + 0x48, 2) + read_words(machine, base + 0x30, 3) + read_words(machine, base + 0x0C, 3)
        fields[f"racer{index}.body.wheels"] = wheel_words
        probe_words = []
        for wheel in range(4):
            base = racer + 0x3E8 + 0x198 + 0x70 * wheel
            probe_words += read_words(machine, base + 0x18, 6) + read_words(machine, base + 0x00, 3) + read_words(machine, base + 0x50, 4)
        fields[f"racer{index}.body.wheelProbes"] = probe_words
        fields[f"racer{index}.volume.sphere"] = read_words(machine, racer + 0x1C + 4, 4)
        vehicle = racer + 0x18
        body = machine.read_u32(vehicle + 0x3C)
        driver = machine.read_u32(vehicle + 0x48)
        fields[f"racer{index}.volume.body"] = read_words(machine, body + 0x04, 4)
        fields[f"racer{index}.volume.driver"] = read_words(machine, driver + 0x04, 4)
        fields[f"racer{index}.vehicle.bodyRotation"] = read_words(machine, body + 0x28, 9)
        fields[f"racer{index}.vehicle.driverPosition"] = read_words(machine, driver + 0x4C, 3)
        fields[f"racer{index}.display.sphere"] = read_words(machine, display + 0x04, 4)
        fields[f"racer{index}.display.position"] = read_words(machine, display + 0x4C, 3)
        fields[f"racer{index}.display.rotation"] = read_words(machine, display + 0x28, 9)
    for index in range(local_players):
        controller = race + CONTROLLER_OFFSET + CONTROLLER_STRIDE * index
        for name, offset, count in CONTROLLER_FIELDS:
            fields[f"player{index}.{name}"] = read_words(machine, controller + offset, count)
    for name, offset in EMITTER_POOLS:
        instance_words, handle_words = snapshot_emitter_pool(machine, race + offset)
        fields[f"emitters.{name}.instances"] = instance_words
        fields[f"emitters.{name}.handles"] = handle_words
    fields["race.phase"] = [machine.read_u32(race + 0x3328)]
    fields["race.phaseMilliseconds"] = [machine.read_u32(race + 0x332C)]
    fields["race.randomPosition"] = [machine.read_u32(race_session.RANDOM_CURSOR)]
    fields.update(track_trace.snapshot_track_fields(machine, race, racer_count))
    return fields


class TraceRun:
    def __init__(self, machine, race: int, scenario: dict):
        self.machine = machine
        self.race = race
        self.scenario = scenario
        self.frames = scenario["frames"]
        self.local_players = scenario.get("localPlayerCount", 1)
        self.racer_count = machine.read_u32(race + RACER_SET_OFFSET + 0x144)
        self.pump_count = 0
        self.held_keys = set()
        self.out = sys.stdout

    def on_pump(self) -> None:
        machine = self.machine
        machine.apply_fpu_option()
        os_state = machine.operating_system
        index = self.pump_count
        if index > 0:
            delta = machine.read_u32(APPLICATION_BASE + FRAME_DELTA_OFFSET)
            fields = snapshot_fields(machine, self.race, self.racer_count, self.local_players)
            self.out.write(json.dumps({"frame": index - 1, "dt": delta, "fields": fields}) + "\n")
        if index >= len(self.frames):
            machine.request_stop("trace complete")
            return
        frame = self.frames[index]
        wanted = set(frame.get("keys", []))
        for code in sorted(wanted - self.held_keys):
            machine.com.send_key(code, True)
        for code in sorted(self.held_keys - wanted):
            machine.com.send_key(code, False)
        self.held_keys = wanted
        if index == 0:
            machine.write_u32(APPLICATION_BASE + LAST_TIME_OFFSET, os_state.now_milliseconds)
        os_state.now_milliseconds = machine.read_u32(APPLICATION_BASE + LAST_TIME_OFFSET) + frame["dt"]
        self.pump_count += 1


def run_scenario(scenario: dict) -> None:
    machine = boot.create_machine({"fpu": scenario.get("fpu", "auto")})
    boot.boot_to_front_end(machine)
    machine.apply_fpu_option()
    race = race_session.begin_race(machine, scenario)
    machine.apply_fpu_option()
    trace = TraceRun(machine, race, scenario)
    machine.add_address_hook(race_session.PUMP_MESSAGES, trace.on_pump)
    reason = machine.call_function_until_stop(race_session.RACE_RUN_LOOP, "thiscall", [race])
    sys.stdout.write(json.dumps({"isDone": True, "reason": reason, "frames": trace.pump_count, "controlWord": machine.uc.reg_read(UC_X86_REG_FPCW)}) + "\n")
    sys.stdout.flush()


def main() -> None:
    source = open(sys.argv[1]).read() if len(sys.argv) > 1 else sys.stdin.read()
    run_scenario(json.loads(source))


if __name__ == "__main__":
    main()

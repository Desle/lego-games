# Feature: golden-trace

## Behaviour

Compares the whole race of the original game with the port, frame for frame. The original (`LEGORacers.exe` + `GolDP.dll`) runs in the emulator through its real start-up, race loading and `Race_RunLoop` with scripted frame times and keys (`reverse-engineering/emulator/golden_trace.py`); the port runs `loadRaceDefinition` + `stepRace` with the same frames. Every observed field of every racer, the local player's controller and the race are compared bit for bit after every frame, and the first difference is reported with both values. Method, scenarios, the divergences found and what is still open are in `.docs/reverse-engineering/golden-trace.md`.

## User flows

- **Run it**: `pnpm run golden-trace` at the repository root (about two minutes). It skips without the virtualenv or the original files and is not part of `pnpm run check`.
- **Read a scenario's original trace**: `readOriginalTrace(scenario)` starts the emulator process and returns one `TraceFrame` per frame (words of every field, the frame time the game used) with the x87 control word and the introduction camera's length.
- **Replay it in the port**: `getPortTrace(scenario, definition)` steps the port with the same frames and returns the same named fields; `getTraceFields` names them.
- **Compare**: `compareTraces(original, port, fieldNames)` returns the first difference and, per field, the first frame it differs in and in how many frames.
- **Run both**: `runGoldenTrace(scenario, jam, executable)` reads the original, loads the port with the original's precision and camera length, and compares; `getPlayerDivergences` keeps the player's.
- **Build scenarios**: `createTraceScenario`, `holdBindings`, `getIdleFrames`, `getSteeringSweepFrames`, `getWeavingFrames` and `getRouteDrivingFrames` (closed-loop keys that follow a computer racer's path).

## Invariants

- A match means every observed 32-bit word is equal (any two NaNs count as equal); nothing is compared by tolerance.
- The port side is the real simulation: it never reads the original's values except the introduction camera's length, which stands in for the camera animation the port does not model.
- The trace only reads emulator memory and the port's state; it never changes either.

## Out of scope

Rendering and sound; the car builder (the player drives a champion car); mirrored races, multiplayer, ghosts, the pause menu and the circuit runner; the racer's collision volume (recorded, not compared: it needs the chassis model's bounds).

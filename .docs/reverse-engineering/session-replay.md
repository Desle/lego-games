# Session replay: the player's own races as regression tests

A race of the port is a pure function of its load options, its random cursor and, per frame, the integer frame time and the input state ([golden-trace.md](golden-trace.md) feeds the original the same). The viewer records exactly those, so any session can be replayed later on the port and on the original in the emulator, and the first divergence found.

## Recording (viewer)

- `packages/lego-racers-web/.../race-recording/race-recording.ts`: `createRaceRecording(start, search)` is called when a race starts (`beginRace` in the race controller). It returns `null` in the high-definition view (`?hd`, `getIsHighDefinitionEnabled`) and for a race with a ghost. The race loop calls `addFrame` for every frame it steps and `finish` when the loop ends or the race is left.
- Each frame holds the integer `dt` (the frame clock's), the `RaceInputSnapshot` (pressed `KeyboardEvent.code` values, gamepad axes and buttons), the menu keys and the developer power-up grant, i.e. the arguments of `stepRace`.
- `session-recording-store.ts` keeps the last 20 recordings in IndexedDB (database `lego-racers-recordings`), falling back to memory; every access is in try/catch. It works in production builds, quietly.
- **Download the last one**: F9, or the "Download the last session recording" button of the developer panel (backquote). Both are development only.

## File format (`*.replay.jsonl`, version 1)

Line 1 is the header (JSON): `raceFolder`, `circuitName`, `racerCodes`, `racerCount`, `localPlayerCount`, `raceModeFlags`, `randomPosition` (the starting random-table cursor), `isMirrored`, `multiplayerLapCount`, `isPointsRecordPresent`, `isCountdownSkipped`, `playerCars` (the builder's answer) and `playerRacers` (the save's racer record, with its car design bytes, for each local player). Every later line is a frame: `[dt, [key codes], gamepad | null, menu | null, grant | null]`. About 30 bytes a frame. Only inputs and settings: no game data, so small files may be committed.

## Replay

`pnpm run replay <file> [--write-expectation]` (needs `original-files/` and the emulator virtualenv, `reverse-engineering/emulator/setup.sh` runs first):

1. **Port**: `replayOnPort` loads the race from the header with the recorded car (`getReplayLoadOptions`) and steps `stepRace` with the recorded inputs; the report gives the final phase and random cursor.
2. **Original**: `getReplayScenario` turns the header and frames into a golden-trace scenario (race session start with those settings, scripted `timeGetTime`, DirectInput scan codes per frame) and `runGoldenTrace` compares every field provider bit for bit, reporting the first divergence (frame, field, both values).
3. The pixel trace of selected frames is not wired in (open).

Limits, all reported by the command: the emulator is fed keyboard frames only, so it stops at the first gamepad frame, menu key (pause) or developer grant; it drives the champion car of the first racer code (the car builder is not run), so the original comparison is exact for races where the player's car is the champion car, and a race with a built car compares the port with the champion car; two or more local players and race mode flags are not fed; the emulator has no sound device, so the racing tune's random draw is absent from the comparison (`musicTuneCount: 0`), as in every golden trace.

## Permanent tests

`reverse-engineering/replays/<name>.replay.jsonl` with `<name>.expected.json` (`comparedFrameCount` and the expected first divergence, `null` for none). `pnpm run golden-trace` runs `replay-folder.golden.spec.ts`: each file is replayed and must diverge exactly where its expectation says, so fixing a divergence makes the test fail until the expectation is updated. To keep a session: download it (F9), copy it into the folder, run `pnpm run replay <file> --write-expectation`, commit both.

## Proof

`synthetic-royal-knights.replay.jsonl` (385 frames: the introduction, full throttle, a left turn) was made through the viewer's recorder (`race-recording.spec.ts` drives `createRaceRecording` headlessly with a session on the save's default car). The spec checks that the port replay equals the live headless run field for field, and that the recorder's output equals the committed file. The original in the emulator matches the port bit for bit on all 385 frames (`pnpm run replay`).

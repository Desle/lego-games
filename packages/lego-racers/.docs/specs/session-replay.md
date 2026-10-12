# Feature: session-replay

## Behaviour

Turns the player's own play sessions into regression tests. The viewer records, for the race that runs in the classic view, everything that feeds the deterministic simulation: the race settings and race folder, the player's car and driver bytes from the save, the starting random cursor, and per frame the integer frame time and the input state `stepRace` received. The recording is a JSON-lines file. `pnpm run replay <file>` feeds it to the port headlessly and to the original in the emulator and reports the first divergence. Method, file format and limits are in `.docs/reverse-engineering/session-replay.md`.

## User flows

- **Record**: play a race in the classic view; the recording is kept in the browser's IndexedDB (the last 20). Press F9 or use the developer panel's button (backquote) to download the last one as `<race>-<time>.replay.jsonl`.
- **Replay**: `pnpm run replay <file>` prints the frames, the port's final phase and random cursor, and either "no divergence" or the first divergence (frame, field, both values). `--write-expectation` writes the `.expected.json` beside the file.
- **Make it permanent**: commit the recording and its `.expected.json` in `reverse-engineering/replays/`; `pnpm run golden-trace` replays every file there and checks its expected first divergence.
- **Replay in code**: `replayOnPort`, `getReplayScenario`, `runReplay`; recordings are written and read with the `session-recording` module.

## Invariants

- Nothing is recorded in the high-definition view (`?hd`), nor for a race with a ghost.
- A recording holds only inputs and settings: no original game data.
- The port side of a replay uses exactly the input snapshot, menu keys and developer grants the live race step received.
- Storing a recording never throws and never stops the game.

## Out of scope

Gamepad, menu keys and developer grants are replayed on the port but not fed to the original; the original drives the champion car (the car builder is not run in the emulator); the pixel trace of selected frames.

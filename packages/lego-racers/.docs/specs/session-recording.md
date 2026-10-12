# Feature: session-recording

## Behaviour

The browser-safe half of session replay: the recording file format (`serializeRecording`, `parseRecording`), the header that captures a race's settings and the player's car (`createReplayHeader`, `getReplayLoadOptions`), and the per-frame recorder (`createReplayRecorder`). The viewer imports only this module; replaying against the original lives in `session-replay`, which starts the emulator through Node and must never reach a browser bundle.

## User flows

- **Record in the viewer**: the race controller creates a header and a recorder for a classic-view race, adds each frame's time and input, and serializes the recording into the browser's store.
- **Read a recording back**: `parseRecording` turns the JSON-lines file into the header and frames that `session-replay` replays.

## Invariants

- No import, direct or indirect, of Node APIs or the emulator: the viewer bundles this module.
- A recording holds only inputs and settings: no original game data.
- A race with a ghost gets no header and is not recorded.

## Out of scope

Replaying a recording (`session-replay`).

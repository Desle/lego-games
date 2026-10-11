# Feature: ghost

## Behaviour

Parses a `.GHB` recorded ghost exactly as `Ghost_Load` (`LEGORacers.exe` `0x00423160`) does: three leading integers (the lap times), a second integer, the start position and quaternion, and the samples `GhostRecorder_RecordSample` (`0x00422710`) records every 250 ms (an int16 position and four orientation bytes each). It also holds the ghost object of a time trial: the champion's run, the best run of the session and the run being recorded, the recorder, the playback of the cars and the choice of the best run.

## User flows

- **Parse a ghost**: the race session passes the bytes of `GHOST.GHB` and the ghost's mirror flag (ghost flags bit `0x20`) to `parseGhost` and gets the ghost and `readByteCount`.
- **Run a time trial**: `createGhostSession`, `loadChampionGhost` (race load), `beginGhostRun` (countdown ends), `recordGhostSample` (every sub-step), `finishGhostRun` (the human finishes), `getIsChampionBeaten` (the race loop ends), `restartGhostRun` (pause menu restart).
- **Draw the ghost cars**: `stepGhostPlayback` gives the pose of the best run's car and the champion's car for the clock.
- **Keep a ghost**: `encodeGhost` writes a run as a `.GHB` (the original never does; it keeps the best run in memory).

## Invariants

- The file is `0x2c { keywords }`; nothing after the closing curly is read. `0x27` reads `[ count ] {` count samples of seven integers `}`; any keyword outside `0x27`..`0x2b` is a syntax error.
- Sample positions are kept as int16 and orientation values as bytes, as the original's stores truncate them.
- A mirrored ghost negates the y of the start position and of every sample, the quaternion's second and fourth components, and orientation bytes 1 and 3.
- More than 961 samples throws `TooManyGhostSamplesError`, where the original would overwrite its own fields; the recorder stops at 961.
- A finished run becomes the best run when its lap times add up to less than the best run's or there is none.

## Out of scope

Finding the ghost file in the JAM (the session module does), the ghost car's models and their rendering.

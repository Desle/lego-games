# Feature: ghost

## Behaviour

Parses a `.GHB` recorded ghost exactly as `Ghost_Load` (`LEGORacers.exe` `0x00423160`) does: three leading integers, a second integer, the start position and quaternion, and the samples `GhostRecorder_RecordSample` (`0x00422710`) records every 250 ms (an int16 position and four orientation bytes each).

## User flows

- **Parse a ghost**: the race session passes the bytes of `GHOST.GHB` and the ghost's mirror flag (ghost flags bit `0x20`) to `parseGhost` and gets the ghost and `readByteCount`.

## Invariants

- The file is `0x2c { keywords }`; nothing after the closing curly is read. `0x27` reads `[ count ] {` count samples of seven integers `}`; any keyword outside `0x27`..`0x2b` is a syntax error.
- Sample positions are kept as int16 and orientation values as bytes, as the original's stores truncate them.
- A mirrored ghost negates the y of the start position and of every sample, the quaternion's second and fourth components, and orientation bytes 1 and 3.
- More than 961 samples throws `TooManyGhostSamplesError`, where the original would overwrite its own fields.

## Out of scope

Finding the ghost file, recording ghosts and replaying them.

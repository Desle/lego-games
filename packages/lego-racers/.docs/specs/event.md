# Feature: event

## Behaviour

Parses a race's `EVENT.EVB` exactly as `Events_Load` (`LEGORacers.exe` `0x0045efa0`) does: thirteen section readers (`0x28`, `0x29`, `0x2a`, `0x39`, `0x3d`, `0x42`, `0x4b`, `0x4d`, `0x51`, `0x52`, `0x53`, `0x55`, `0x59`) fill the race's event arrays. The track events announce numbered signals to each other, to the hazards and to the timers.

## User flows

- **Parse events**: the race passes the file's bytes and its mirror flag to `parseEvents` and gets one array per section, in file order, and `readByteCount`.

## Invariants

- A section is `keyword [ count ] {`, count blocks and `}`; a block is `0x27 identifier`, an optional `0x3c`, `{`, keywords and `}`. Sections 0x51 and 0x55 have no `0x3c`.
- `0x27` inside a block takes `0x36`, `0x34` or `0x37` and an integer: the signals the event announces in its states 2, 3 and 4. Any other keyword, or token after `0x27`, is a syntax error.
- A mirrored track negates the y component of the positions (`0x2a`, `0x3d`, `0x55`, `0x59`) and the second and fifth floats of `0x3d` keyword `0x3e`.
- A section seen twice replaces the first; any other top-level token is a syntax error. Every original file is read to its last byte.

## Out of scope

Looking the object names up in the world's tables, and running the events.

# Feature: trigger

## Behaviour

Parses a race's `.TRB` trigger files exactly as the game does: `Triggers_Load` (`LEGORacers.exe` `0x00465210`) opens the list, the main-trigger reader (`0x00463dc0`, `MAINTRIG.TRB` or the file named by race description keyword `0x39`) and the environment reader (`0x00464ff0`, `ENVIRON.TRB`) read the blocks. Each trigger has a position, a radius, an integer and flags; main triggers may also name a collision-world object and carry a second integer.

## User flows

- **Parse triggers**: the race passes the file's bytes, `TriggerFileKind.MAIN` or `TriggerFileKind.ENVIRONMENT`, and its mirror flag to `parseTriggers` and gets the triggers in file order and `readByteCount`.

## Invariants

- The file is `0x27 [ count ] {` and count blocks `0x27 { keywords }`; the list's closing curly is never read, so `readByteCount` stops one byte before the end of every original file.
- Both kinds accept `0x29` position, `0x2a` radius, `0x2b` integer and `0x2f` flag; only main triggers accept `0x2c` flag, `0x2d` object name (at most 8 characters) and `0x2e` integer. Any other keyword is a syntax error.
- A mirrored track negates the position's y component.

## Out of scope

Resolving the object name to an index in the collision world, and registering the triggers with the race's event system (`0x004653f0`).

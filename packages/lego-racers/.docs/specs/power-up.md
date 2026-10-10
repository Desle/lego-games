# Feature: power-up

## Behaviour

Parses a race's `.PWB` power-up placements exactly as `PowerUps_Load` (`LEGORacers.exe` `0x00458810`) does: the power-up bricks with their position, kind (1 to 4) and identifier, and the enhancement bricks (built with the models `enh` and `enhblen`) with their position.

## User flows

- **Parse power-up placements**: the race passes the bytes of `POWERUP.PWB` (or `POWERUP2.PWB` when racing a ghost) and its mirror flag to `parsePowerUps` and gets `bricks`, `enhancementBricks` and `readByteCount`.

## Invariants

- Keywords are read until the end of the file: `0x27` reads the brick list and `0x2f` the enhancement-brick list; any other top-level token is skipped, as in the original.
- Each list is `[ count ]`, then for a non-zero count `{ block * count }`; each block starts with its list keyword and `{`.
- A brick starts as kind 3 with identifier -1; `0x2a`, `0x2c`, `0x2d` and `0x2b` set kinds 1, 2, 3 and 4, `0x2e` the identifier. `0x30` reads a name and an integer and `0x31` an integer, both dropped. Any other keyword is a syntax error; an enhancement brick accepts only `0x28`, `0x30` and `0x31`.
- A mirrored track negates every position's y after the block is read.

## Out of scope

The race-mode override of the brick kind (race flags at power-up system `+0x58`), the brick models, and what each kind does when collected.

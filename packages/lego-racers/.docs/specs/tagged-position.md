# Feature: tagged-position

## Behaviour

Parses a race's `.TGB` file (named by race description keyword `0x4a`, present on five tracks) exactly as `Tgb_Load` (`LEGORacers.exe` `0x0045c3d0`) does: a list of positions, each with an integer identifier. What the race uses them for is not known yet.

## User flows

- **Parse tagged positions**: the race passes the file's bytes and its mirror flag to `parseTaggedPositions` and gets the positions in file order and `readByteCount`.

## Invariants

- The file is `0x27 [ count ]`; when the count is not zero, `{ (0x27 { keywords }) * count }` follows. With a count of zero the original reads nothing more.
- Keywords are `0x28` position (3 floats) and `0x29` identifier (integer); any other is a syntax error. Defaults are the origin and identifier -1.
- A mirrored track negates the position's y component.

## Out of scope

The role of these positions in the race (`race +0x2804`), which is not recovered yet.

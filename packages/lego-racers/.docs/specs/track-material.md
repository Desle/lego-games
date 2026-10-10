# Feature: track-material

## Behaviour

Parses a race's `.TMB` track materials exactly as `TrackMaterials_Load` (`LEGORacers.exe` `0x00444030`) and its block reader `0x00443cf0` do: per surface material name, up to seven integers, two vectors, five floats, a linked name and three flags, with the presence mask the original builds.

## User flows

- **Parse track materials**: the race passes the bytes of `RACECxRy.TMB` and its mirror flag to `parseTrackMaterials` and gets the entries in file order and `readByteCount`.

## Invariants

- The file is `0x27 [ count ] { (0x27 "name" { keywords }) * count }`; names are at most 8 characters.
- Each keyword stores its value and sets its bit in `flags` (`0x2` for `0x28` up to `0x40000` for `0x39`); bit 1 is set once the block is read. Absent values are zero, as `0x00443ca0` resets them. Any other keyword is a syntax error.
- A mirrored track negates the y component of both vectors.

## Out of scope

Matching the names against the collision world's surfaces, and what each value does to a racer.

# Feature: material-animation

## Behaviour

Parses a `.MAB` material animation into plain, frozen data, reading it exactly as the Gol engine's loader (`GolDP.dll` `0x100258f0`) does: the material list and the entries with their values.

## User flows

- **Parse a material animation**: the game passes the bytes of a `.MAB` file to `parseMaterialAnimation` and gets back `materials`, `entries` and `readByteCount`.

## Invariants

- The `0x27` section comes first and the `0x28` section second; a count of 0 is an invalid value.
- Every entry starts from the defaults 0, 1, 1 and 30 (× 0.001).
- Nothing after the `0x28` section is read.

## Out of scope

Looking up the materials (`0x10028c20`), playing the animation, and the copy of the loader in `LEGORacers.exe` (`0x0040fed0`).

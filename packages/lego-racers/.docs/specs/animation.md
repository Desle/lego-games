# Feature: animation

## Behaviour

Parses a `.ADB` animation into plain, frozen data, reading it exactly as the Gol engine's animation loader (`GolDP.dll` `0x100188e0`) does: the three lists of the `0x27` block, the `0x2b` entries and the named `0x2c` entries.

## User flows

- **Parse an animation**: the game passes the bytes of a `.ADB` file to `parseAnimation` and gets back the lists, in file order, and `readByteCount`.

## Invariants

- Every `0x2c` entry starts from the constructor's defaults (`0x10018640`) and keywords change them in file order.
- `0x2c` entry names compare over their first eight characters; a repeat is fatal.
- Each list keeps the last one read; the file is read to its end.

## Out of scope

Playing animations, which `skeletal-animation` does, and the copy of the loader in `LEGORacers.exe` (`0x00401260`).

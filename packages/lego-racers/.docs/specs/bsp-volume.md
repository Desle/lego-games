# Feature: bsp-volume

## Behaviour

Parses a `.BVB` BSP volume into plain, frozen data, reading it exactly as the Gol engine's loader (`GolDP.dll` `0x1001b800`) does: material names, vectors, four-value entries and nodes.

## User flows

- **Parse a BSP volume**: the game passes the bytes of a `.BVB` file to `parseBspVolume` and gets back `materialNames`, `keyword34Vectors`, `keyword2dEntries`, `nodes` and `readByteCount`.

## Invariants

- The material list and the vector list may appear once each (error 18 otherwise); a repeated entry or node section replaces the earlier one.
- Child values are int16 node indices or the markers -1 and -2; the fixed-point nodes scale their three ints by 2^-30.
- The vector count is kept as a 16-bit word, as in the original.

## Out of scope

Looking up material names in the world (`0x10028c20`), the stack-depth pass `0x1001be50`, and collision queries.

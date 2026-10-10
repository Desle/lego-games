# Feature: font-database

## Behaviour

Parses a `.FDB` font database into plain, frozen data, reading it exactly as the Gol engine's font database loader (`GolDP.dll` `0x1001d8f0`) does: for every font its name, flags, character list, a value and two byte triples.

## User flows

- **Parse a font database**: the game passes the bytes of a `.FDB` file to `parseFontDatabase` and gets back `fonts`, in file order, and `readByteCount`.

## Invariants

- Characters are one-character strings (an empty string is 0) or integers 0..0xffff; anything else is a syntax error.
- More than 100 characters would overwrite the original loader's stack; the port refuses them.
- Names are at most eight characters and a repeated name is fatal, as in the original.
- A count of 0 stops after the opening curly; otherwise nothing after the closing curly is read.

## Out of scope

Building the glyphs from the image database (`0x1001df80`, `0x1002f9b0`).

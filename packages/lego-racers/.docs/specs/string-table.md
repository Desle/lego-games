# Feature: string-table

## Behaviour

Parses a `.SRF` localised string table (for example `GAME.SRF`) into its offsets and 16-bit characters exactly as `StringTable_Load` (`LEGORacers.exe` `0x0044e2c0`) does, and looks strings up by index like `StringTable_GetString` (`0x0044e540`).

## User flows

- **Parse a string table**: the game passes the bytes of a `.SRF` file to `parseStringTable` and gets back `offsets`, `characters` and `readByteCount`.
- **Look up a string**: the game calls `getString(table, index)` and gets the characters from that string's offset up to the terminating zero, or `null` for an index above the count.

## Invariants

- The file is read as `uint16 count`, `uint16 characterCount`, `count` offsets and `characterCount` characters, all little-endian; nothing after them is read.
- A file shorter than its counts say throws `TruncatedStringTableError` (the original's load returns failure).
- `getString` returns `null` only when the index is above the count, as the original's `>` test does; the index equal to the count, or a string without a terminating zero, would read outside the table in the original and throws `StringTableOverreadError`.

## Out of scope

Choosing the language's `.SRF` file and drawing the strings with a font.

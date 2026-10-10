# Feature: texture-database

## Behaviour

Parses a `.TDB` texture database into plain, frozen data, reading it exactly as the Gol engine's texture database loader (`GolDP.dll` `0x1002b5a0`) does: for every texture its name, flags, the `0x29` value and the `0x2c` byte triple.

## User flows

- **Parse a texture database**: the game passes the bytes of a `.TDB` file to `parseTextureDatabase` and gets back `textures`, in file order, and `readByteCount`.
- **Register texture names**: a world registers each texture's `name` unless `isNameRegistered` is false (an earlier texture of the same file has it).

## Invariants

- Every texture starts from flags 0, value 0 and bytes `0 0 0`; keywords change them in file order, and flag `0x800` is always added.
- Names are at most eight characters (longer is an invalid string); a repeated name is not an error.
- A count of 0 stops after the opening curly; otherwise nothing after the closing curly is read.

## Out of scope

Searching the textures already loaded by other databases of the same world (`0x10028b90`), loading the bitmaps, and the post-processing `0x1002b890`.

# Feature: world

## Behaviour

Reads LEGO Racers' `.WDB` world files (the scene description of every track and menu screen) exactly as `GolDP.dll` loads them, and returns their contents as frozen plain data: the lists of texture, material, animation, mesh, skeleton, BSP and material-animation files a scene needs, and its mesh, skeleton and BSP instances, BSP volumes, sprites, cameras and lights. It also exposes the original's binary token reader, which the `.GDB`/`.MDB` loaders share.

## User flows

- **Read a world**: the game passes the bytes of a `.WDB` file and gets a `World` back. Sections the file leaves out are empty lists. An empty file is an empty world.
- **Read a broken world**: bytes that break the format fail with a `TokenReaderError` carrying the original's message (`Expected int`, `Unexpected keyword`, `Invalid value`, ...).
- **Read tokens**: another loader creates a token reader over a file's bytes and pulls tokens and typed values from it (`readInteger`, `readFloat`, `readString`, `readArrayCount`, ...), exactly as the original's reader at `0x10030300` hands them out.

## Invariants

- Every top-level section may appear at most once; a second one fails with `Unexpected keyword`, and a count of zero fails with `Expected int`.
- Top-level tokens without a handler are skipped silently, as the original's dispatch loop does.
- Names are cut to eight characters, like `strncpy(name, value, 8)`.
- An index into another section fails with `Invalid value` when it is out of range, but is not checked while that section is still missing, as in the original.
- A negative level distance is stored as the largest float, `0x7f7fffff`.
- A camera's second orientation vector is stored negated, and a camera target replaces its forward vector with `target - position` once its block ends.
- Truncated values are a syntax error; running out of data between tokens ends the file.
- Where the original would write past one of its fixed arrays (a fourth level, a negative material slot, a macro outside its 16-entry table), the port throws `WorldOverflowError` or `TokenReaderOverflowError` instead. No original file does this.

## Out of scope

Building the scene: loading the referenced `.TDB`/`.MDB`/`.GDB`/... files and the reference checks done while linking them (`0x10017ac0`, `0x1002e640`). The text (`.wdt`-style) reader the original selects when the binary flag is off; the retail game only ships binary files. The meaning of keywords that the loader only copies into objects without evidence of what they do; those keep neutral names such as `keyword36Value`.

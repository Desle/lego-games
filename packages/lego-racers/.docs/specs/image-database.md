# Feature: image-database

## Behaviour

Parses a `.IDB` image database into plain, frozen data, reading it exactly as the Gol engine's image database loader (`GolDP.dll` `0x10023060`) does: for every image its name, flags and two byte triples.

## User flows

- **Parse an image database**: the game (menus, load screens) passes the bytes of a `.IDB` file to `parseImageDatabase` and gets back `images`, in file order, and `readByteCount`.

## Invariants

- Every image starts from flags 0, bytes `0 0 0` (keyword `0x2b`) and `ff ff ff` (keyword `0x2c`); keyword `0x2b` also sets flags `0x20` and `0x800`.
- Names are at most eight characters and a repeated name is fatal, as in the original.
- A count of 0 stops after the opening curly; otherwise nothing after the closing curly is read.

## Out of scope

The flags `0x40` and `0x80` the loader derives from device capabilities, and loading the images' bitmaps.

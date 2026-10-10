# Feature: material

## Behaviour

Parses a `.MDB` material library into plain, frozen data, reading it exactly as the Gol engine's material loader (`GolDP.dll` `0x10026270`) does: for every material its name, render flags, texture name, ambient and diffuse colors, alpha test and blending settings.

## User flows

- **Parse a material library**: the game passes the bytes of a `.MDB` file to `parseMaterialLibrary` and gets back `materials`, in file order, and `readByteCount`.
- **Apply a material**: the renderer reads a material's `flags` and settings the way `0x1000a2c0` does (shading, texture blending, filtering, addressing, alpha test, blending, opacity).

## Invariants

- Every material starts from the original's defaults (flags `0x0050a694`, white colors, alpha function 2, source blend 1) and keywords change them in file order.
- Material and texture names are at most eight characters (longer is an invalid string), and a repeated material name is fatal, as in the original.
- Nothing after the library's closing curly is read.

## Out of scope

Looking up texture names in a texture library (`0x10028b90`) and the texture-dependent adjustments `0x100257e0` makes when it copies a definition into a material.

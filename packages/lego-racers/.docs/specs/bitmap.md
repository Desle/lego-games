# Feature: bitmap

## Behaviour

Decodes the game's own `.BMP` texture format from `LEGO.JAM` into the engine's in-memory form (palette and pixel rows), exactly as `GolDP.dll` does, and can expand the result to RGBA for display.

## User flows

- **Decode a texture**: the game passes the bytes of a `.BMP` from the JAM archive and gets back its width, height, bit depth, 256-entry RGBA palette and pixel rows (top to bottom, rows padded to four bytes).
- **Get display colors**: a renderer passes a decoded bitmap and gets RGBA pixels, top row first.

## Invariants

- Only the bit depths the original accepts (4, 8, 24 and 32) decode; any other depth fails with "Invalid BMP file", as in the original.
- Palette entries are stored B, G, R and become R, G, B, 255; entries past the stored count stay zero.
- Pixel data is read in blocks of `uint16 decompressedLength, uint16 compressedLength`; a block is LZSS-compressed only when its compressed length is smaller, and leftover bytes of a block carry into the next row.
- Every texture in the English `LEGO.JAM` (1,616 files) decodes, and each one is consumed exactly to its last byte.

## Out of scope

Real Windows bitmaps (starting with `BM`), which the engine also reads but which never occur inside `LEGO.JAM`, and transparency, which materials decide.

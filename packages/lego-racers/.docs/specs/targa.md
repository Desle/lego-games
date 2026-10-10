# Feature: targa

## Behaviour

Decodes the `.TGA` images in `LEGO.JAM` into the same in-memory form as `bitmap` (palette and pixel rows), the way the Gol engine's Targa loader (`GolDP.dll` vtable `0x10057578`, header `0x1002a5e0`, pixels `0x1002ae50`) reads them, so a renderer expands them with `getBitmapColors`.

## User flows

- **Decode a texture**: the scene passes the bytes of a `.TGA` and whether the texture has flag 4 (TDB keyword `0x28`), and gets back width, height, bit depth, the 256-entry RGBA palette and the pixel rows.
- **Read a header**: `readTargaHeader` returns the 18-byte header fields, the row size, where the pixel data starts and the palette.

## Invariants

- The header is the 18 Targa bytes; the colour map is read only for images of at most 8 bits per pixel, and only then does it move the pixel data offset (identifier length + 18 + entries).
- Colour map entries of 15, 16, 24 and 32 bits become R, G, B, A (15 bits opaque, 16 bits alpha 0); an entry size with no case leaves the entries zero.
- A row is `(width · depth + 31) / 8` rounded down to four bytes; the file offset advances by that many bytes per row (so 24-bit rows that are not a multiple of four bytes shear, as in the original).
- Without texture flag 4 the first file row becomes the last row; with it the first row stays first. The descriptor byte and the origin are not used.
- Image types 9 and above are decoded as packets by the loader's routine (`0x1002ad40`) over the same fixed-size row reads.
- Depths other than 4, 8, 16, 24 and 32 fail with "Unsupported color depth encountered".

## Out of scope

Depths 4 and 16, whose conversion into the display surface (`0x10020d60` and others) depends on the surface format and are not exercised by the game files; the colour key (the scene applies it); the surface upload.

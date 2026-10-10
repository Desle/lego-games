# Bitmaps (`.BMP` in `LEGO.JAM`)

Source: `GolDP.dll` (image base `0x10000000`). The engine's bitmap object keeps a 256-entry RGBA palette at `+0xa8`, width `+0x44`, height `+0x48`, stride `+0x4c`, bit depth `+0x66`, data offset `+0xecc` and compression `+0xed4` (`0x80` = the game's own block format).

| Address      | Role                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| `0x10018da0` | Reads the header. `BM` → Windows bitmap; anything else → the game's own format (below)      |
| `0x10019fe0` | Reads the pixels. Compression `0x80` → blocks + LZSS, rows top to bottom; else Windows rows |
| `0x10032840` | LZSS decompressor (hand-written assembly), `(source, destination)`, returns bytes written   |

## Header

```
0x00  uint8   kind       bits 0x3c = bits per pixel (4, 8, 24 or 32; anything else → "Invalid BMP file")
                         bit 0x80  = no stored palette
0x01  uint8   colorCount - 1     (ignored above 8 bits per pixel or with 0x80)
0x02  uint16  width
0x04  uint16  height
0x06  colorCount × { uint8 blue, uint8 green, uint8 red }   → palette entry R, G, B, 255
      pixel blocks
```

Stride is `((width × bitsPerPixel + 31) >> 3) & ~3`. A row holds `(width × 4 + 4) >> 3` bytes at 4 bits per pixel and `(width × bitsPerPixel) >> 3` otherwise. At 4 bits the high nibble is the left pixel; 24 and 32 bits are stored B, G, R (, A).

## Pixel blocks

```
uint16 decompressedLength   (≤ 1500: one shared buffer at bitmap + 0x8f0)
uint16 compressedLength
compressedLength < decompressedLength ? compressedLength bytes of LZSS : decompressedLength raw bytes
```

Rows are filled top to bottom from the concatenated block output; a block's leftover bytes start the next row. Compressed data is copied to the end of the shared buffer and decompressed to its start.

## LZSS (`0x10032840`)

1. Copy the first byte.
2. Read a flag byte; walk its bits from the most significant. A clear bit copies one literal byte.
3. A set bit reads a token `t` and the next byte `d`: distance = `(t >> 4) << 8 | d`.
   - `t & 0xf ≠ 0`: length = `18 − (t & 0xf)` (3–17), two bytes consumed.
   - `t & 0xf = 0`: length = next byte + 18 (18–273), three bytes consumed. The length byte is read even when the distance turns out to be 0.
   - Distance 0 ends the stream. Otherwise copy `length` bytes from `distance` back, one byte at a time (overlap allowed).
4. After eight bits, read the next flag byte.

The assembly tracks flags in `EBX` with a sentinel bit and detects the end of a flag byte with the parity flag (`JP`).

## Verified

All 1,616 `.BMP` files in the English `LEGO.JAM` decode with block sizes that match, and each is consumed exactly to its end. Kinds in use: `0x04` (1,473), `0x08` (138), `0x98` (5, 24-bit). Rendering `MENUDATA\DANISH\FONT_HLP.BMP` shows readable, upright text, which confirms row order and nibble order.

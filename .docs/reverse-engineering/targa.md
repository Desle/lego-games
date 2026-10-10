# Targa images (`.TGA` in `LEGO.JAM`)

Source: `GolDP.dll` (image base `0x10000000`). Port: `packages/lego-racers/src/modules/targa`, used by the `scene` module for textures with flag `0x10` (TDB keyword `0x2b`). The English `LEGO.JAM` holds nine: `GAMEDATA\COMMON\{LITFLASH,TFLAME2,TFLAME3,TFLAME4,CANSTRK,MSLSTRK,LIGHTNG,CSMOKE}.TGA` and `MENUDATA\WINRRCAR\RRSPRKL.TGA`; every one is 32×32, type 2, 32 bits, descriptor `8`, 4,140 bytes (18 header + 4,096 pixels + the 26-byte `TRUEVISION-XFILE` footer, which the loader never reads).

## Class

The Targa object is a static instance at `0x10063ca0` (the bitmap object is `0x10064280`); its vtable is `0x10057578`. `0x1001f330` (texture upload) and `0x1002b890` (database load) pick it when the texture's flags `+0x36` lack bit 8 (bitmap) — the same as flag `0x10`.

| Slot | Address      | Role                                                                                                                                   |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | `0x1002a5e0` | Header: reads the 18 bytes and, for images of at most 8 bits, the colour map                                                           |
| 2    | `0x1002a500` | Open by name: appends `.tga` (string `0x1005cf04`, pointer `0x1005cf00`) unless the name already ends with it, then `0x1001ffc0` opens |
| 4    | `0x1002a4f0` | Returns the extension pointer                                                                                                          |
| 7    | `0x1002ae50` | Loads the rows into a texture surface (used by `0x1001f330`)                                                                           |
| 8    | `0x1002aa80` | Loads the rows into a memory buffer                                                                                                    |
| —    | `0x1002ad40` | Packet decoder for image types 9 and above                                                                                             |

## Header (`0x1002a5e0`)

Bytes 0..17: identifier length (`+0x5b0`), colour map type (`+0x5b4`), image type (`+0x5b8`), colour map origin (`+0x5bc`), length (`+0x5c0`), entry size (`+0x5c4`), x and y origin (`+0x5c8`, `+0x5cc`), width (`+0x44`), height (`+0x48`), depth (`+0x66`), descriptor (`+0x5d0`). Of these only the length, the entry size, the depth, the width and height and the identifier length are used; the origin and the descriptor are stored and never read (no other reference to `+0x5c8`, `+0x5cc`, `+0x5d0`).

- Stride `+0x4c` = `(width · depth + 31) / 8 & ~3`; `+0x5d8` = stride · height; pixel data offset `+0x5d4` = identifier length + `0x12`.
- A colour map is read only when the colour map type is not 0 and the depth is at most 8: `((entry size + 7) / 8) · length` bytes at the offset, which then advances by that many. With a deeper image the offset is not advanced.
- Entries (at most 256, stored from `+0xa8` as R, G, B, A): 15 bits `R = v >> 7 & 0xf8`, `G = v >> 2 & 0xf8`, `B = v << 3`, A `0xff`; 16 bits the same with A 0; 24 bits B, G, R bytes, A `0xff`; 32 bits B, G, R, A. Other sizes write nothing.
- Depth: 4 → palette mask `0xf`, 8 → `0xff`; 16 → masks `0x7c00`, `0x3e0`, `0x1f`; 24 → `0xff0000`, `0xff00`, `0xff`; 32 → the same plus alpha `0xff000000`; anything else "Unsupported color depth encountered" (`0x1005cbf0`).

## Rows (`0x1002ae50`, `0x1002aa80`)

Each row is read as `stride` bytes at the running offset (`vtable +0x24`), and the offset advances by the bytes read, so a 24-bit image whose rows are not a multiple of four bytes shears. An image type of 9 or more runs the row through `0x1002ad40`: a packet byte's low seven bits are the pixel count less one, bit 7 marks a run, and a packet that would pass the width stops the row (the offset still advances by the stride). The pixel conversion (`0x100207e0` → `0x10020b90`…`0x10022560`) writes into the device surface format and is not ported.

`0x1002ae50` places the first file row as the last row of the texture (`iStack_38 = -1` starting from the last tile row) when its flag argument is 0, which `0x1001f330` fills from texture flag 4 (TDB keyword `0x28`); with the flag the first row stays first.

For true-colour images the colour key (`0x100204d0`) gives matching pixels alpha 0, as for bitmaps.

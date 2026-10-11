# Bitmap font rendering

Source: `LEGORacers.exe` (text routines) and `GolDP.dll` (glyph table). Port: `packages/lego-racers/src/modules/font-rendering`. The FDB file is in [font-database.md](font-database.md).

## A font

A font is an FDB entry (`name`, a character list, spacing `0x2c`, colour key `0x2a`, tint `0x2d`) plus an image named like it (`<name>.BMP`, in the language folder: `GAMEDATA\COMMON\<LANGUAGE>\FONT_THS.BMP`, `MENUDATA\<LANGUAGE>\FONTMENU.BMP` ...). The glyphs are columns of that one image, separated by columns that look like column 0.

### Glyph table (`GolDP.dll` `0x1001df80`, `0x1001e070`, `0x1001e190`, `0x1001e420`, `0x1001e4c0`)

The table has one 12-byte entry per FDB character plus one for the space, kept at `+0x28`, count at `+0x24`:

| Offset | Field                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------- |
| `+0`   | character code (entry 0: `0x20`)                                                                      |
| `+2`   | first column in the image                                                                             |
| `+4`   | texture page (always 0: every font fits one page, or the layout loop of `0x1001e5e0` would never end) |
| `+6/8` | position in the page                                                                                  |
| `+10`  | width                                                                                                 |

Scan (`0x1001e190`): the separator is column 0 (every row of it). `L` = the number of leading columns equal to it = space width (`font +0x18`); the first glyph starts at `L + 1`; each following glyph skips separator columns, then runs until the next separator column; a zero width is the fatal "Incomplete font image". `font +0x1c` = image height, `+0x20` = FDB `0x2c` (letter spacing, signed). The table is then sorted ascending by code (`qsort`, `0x1001f140`).

Port: `buildBitmapFont(definition, bitmap)`. Verified on every font whose image is in `LEGO.JAM` (33 fonts in 19 FDB files). One finding: `MENUDATA\DANISH\GFONTS.FDB`'s `fontmenu` lists 45 characters and `FONTMENU.BMP` of that folder holds 44 glyphs, so the original's scan reaches the fatal error there too (hypothesis: that language is not loadable as shipped, or the surface is wider than the bitmap; the surface width is the bitmap width, `0x1002a3e0`). The spec asserts exactly this one failure.

Hypothesis: 4-bit surfaces are compared in the image's own pixel order (high nibble left, as `bitmap.md`); the code reads even columns from the low nibble, which holds only when the surface stores the low nibble first. Both orders give the same table for the font images in the game except for the first glyph start (the `+1`).

## Text routines (exe)

| Address         | Port                  | What it does                                                                                                                                                                                           |
| --------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0x004092b0`    | `getGlyphIndex`       | Binary search of the sorted table, starts at `count >> 1`, answers 0 (the glyph with the lowest code) when missing                                                                                     |
| `0x00408be0`    | `getTextWidth`        | Sum of advances (space: space width + spacing; else glyph width + spacing) minus one spacing, never negative; height = line height                                                                     |
| `0x00408d50`    | `getWrappedTextSize`  | Same with line breaking at `maximumWidth / scaleX` (`floor`), line advance `ceil((height + offset) * scaleY)`, width `ceil(width * scaleX)` (unsigned result)                                          |
| `0x00408fe0`    | `layoutText`          | Draws the lines: break at the last space, or between letters for a word wider than the line; a centred line starts `(avail - width) >> 1` further right in unscaled pixels; runs of at most 128 glyphs |
| `0x00409300`    | `drawGlyphRun`        | One run: advances `ftol(width * scale)` for the rectangle, a float position `x += width * scale + spacing * scale` for the next glyph; a scale at or below `0x30800000` draws nothing                  |
| `0x00409560`    | `getClipRectangle`    | The part of the surface a clip rectangle leaves                                                                                                                                                        |
| `0x00409690`    | `clipGlyphRectangles` | Moves the destination edges inside the clip and the source edges with them by `ftol(distance / scale)`                                                                                                 |
| `0x00408500` .. | not ported            | The font object's draw interface (begin, page select, blit, end) is a vtable of the surface; the port outputs the blit rectangles instead                                                              |

`getTextLine` is the line-breaking loop that `0x00408d50` and `0x00408fe0` share.

The float code runs in the repository's precision policy (`createFloatArithmetic`, single by default).

## Verification

- `font-text.differential.spec.ts`: 400 random fonts and strings (negative spacing, line breaks, missing characters) in both x87 precisions; `0x00408be0`, `0x00408d50` and `0x004092b0` run in the emulator; width, height and glyph index equal.
- `layout-text.differential.spec.ts`: 300 random draws with clips and centring in both precisions: `0x00408fe0` runs in the emulator with a font whose vtable points at machine code that records every blit (source and destination rectangle); all 8 integers of every glyph equal the port's (more than 1,000 glyphs per precision).

## Where it is used

The race HUD draws its text (`font_ths`, `ignum` of `GAMEDATA\COMMON\ENGLISH\LEGOFNTS.FDB`) through `layoutText` in the viewer (replacing the browser font), measured by `getTextWidth` (`0x00408be0`, as `hud.md` says the HUD does). The menus use the fonts of `GFONTS.FDB` ([front-end.md](front-end.md)). The draw colour multiplies the glyph pixels (the image is grey on a keyed background); `fontmenu`, `font_ths`, `font_emb` and `font_hlp` have colour key `(0,0,0)`, `(0,0,0)`, `(187,195,245)`, `(64,64,64)`.

Not ported: text drawn by the cinema subsystem, the exe's other surface text call (`0x0046f9b0`'s stretched variant, `surface +0x6c`).

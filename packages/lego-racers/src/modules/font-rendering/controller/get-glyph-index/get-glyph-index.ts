import type { BitmapFont } from '../../types/font-rendering.types.ts'

// LEGORacers.exe 0x004092b0: a binary search over the sorted glyph table that starts at the middle
// and answers 0 when the code is missing, so a missing character draws the glyph with the lowest code.
export const getGlyphIndex = (font: BitmapFont, code: number): number => {
  let low = 0
  let high = font.glyphs.length - 1
  let middle = font.glyphs.length >>> 1
  if (high < 0) return 0
  for (;;) {
    const middleCode = font.glyphs[middle]?.code ?? 0
    if (middleCode === code) break
    if (code < middleCode) high = middle - 1
    else low = middle + 1
    middle = (high + low) >> 1
    if (high < low) return 0
  }
  return low <= high ? middle : 0
}

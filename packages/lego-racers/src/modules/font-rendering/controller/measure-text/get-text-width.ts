import { getGlyphIndex } from '../get-glyph-index/get-glyph-index.ts'
import type { BitmapFont, TextSize } from '../../types/font-rendering.types.ts'

const SPACE_CODE = 0x20

// The advance of one character as 0x00408be0 adds it: a space takes the space width, anything else
// its glyph's width, and both the letter spacing.
export const getCharacterAdvance = (font: BitmapFont, code: number): number => {
  if (code === SPACE_CODE) return font.letterSpacing + font.spaceWidth
  const glyph = font.glyphs[getGlyphIndex(font, code)]
  return (glyph?.width ?? 0) + font.letterSpacing
}

// LEGORacers.exe 0x00408be0: the size of a string at scale 1 (width without the last letter spacing, never negative).
export const getTextWidth = (font: BitmapFont, text: readonly number[]): TextSize => {
  let sum = 0
  for (const code of text) sum += getCharacterAdvance(font, code)
  const width = sum - font.letterSpacing
  return Object.freeze({ width: width < 0 ? 0 : width, height: font.lineHeight })
}

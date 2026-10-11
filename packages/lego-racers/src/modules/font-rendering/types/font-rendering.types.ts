import type { FloatArithmetic } from '../../simulation-math/index.ts'

// One entry of the font object's 12-byte glyph table (GolDP.dll 0x1001df80, +0x28 of the font).
export type FontGlyph = {
  // +0: the 16-bit character code; the table is sorted ascending by it.
  readonly code: number
  // +2: the first column of the glyph in the font image.
  readonly imageX: number
  // +10: the glyph's width in columns.
  readonly width: number
}

export type FontColorKey = readonly [number, number, number]

// The font object the exe's text routines (0x00408be0 .. 0x00409700) read.
export type BitmapFont = {
  readonly name: string
  // +0x1c: the font image's height, the height of every glyph.
  readonly lineHeight: number
  // +0x18: the number of leading separator columns of the image.
  readonly spaceWidth: number
  // +0x20: FDB keyword 0x2c, added to every advance (negative values overlap glyphs).
  readonly letterSpacing: number
  // +0x24 entries, ascending by code. Entry 0 is returned for a code the font does not hold.
  readonly glyphs: readonly FontGlyph[]
  // FDB keyword 0x2a (flag 0x20): the colour that is transparent; null without the keyword.
  readonly colorKey: FontColorKey | null
  // FDB keyword 0x2d (+0x3c); white without the keyword.
  readonly tint: FontColorKey
  readonly imageWidth: number
}

// A rectangle in pixels: left and top inclusive, right and bottom exclusive, as the exe passes them.
export type TextRectangle = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type TextScale = {
  readonly x: number
  readonly y: number
}

export type TextSurface = {
  readonly width: number
  readonly height: number
}

export type TextSize = {
  readonly width: number
  readonly height: number
}

// 0x00409300 calls the font's blit with these: a rectangle of the font image drawn into a rectangle of the surface.
export type FontDrawCommand = {
  readonly code: number
  readonly sourceX: number
  readonly sourceY: number
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly destination: TextRectangle
}

export type TextAlignment = 'left' | 'center'

export type TextLayoutParameters = {
  readonly font: BitmapFont
  // UTF-16 code units, as the exe's wide string holds them.
  readonly text: readonly number[]
  readonly surface: TextSurface
  readonly x: number
  readonly y: number
  // 0x00408fe0 param_5: the width the line breaks at, in pixels.
  readonly maximumWidth: number
  // param_6: added to the font height before scaling to give the line advance.
  readonly lineGap: number
  readonly scale: TextScale
  readonly clip: TextRectangle | null
  // param_11: 1 centres each line in the maximum width.
  readonly alignment: TextAlignment
  readonly arithmetic: FloatArithmetic
}

export type TextMeasureParameters = {
  readonly font: BitmapFont
  readonly text: readonly number[]
  // 0x00408d50 param_2, param_3: the break width and the first line's offset.
  readonly maximumWidth: number
  readonly firstLineOffset: number
  readonly scale: TextScale
  readonly arithmetic: FloatArithmetic
}

export type TextLine = {
  // First character of the line, after the spaces that follow a wrapped line.
  readonly start: number
  // One past the last character of the line.
  readonly end: number
  // The advances of the characters from `start` to `end`, the last letter spacing included.
  readonly width: number
  // Where the next line starts, after a carriage return and a line feed.
  readonly nextPosition: number
  // True when the line ended at a line break (the next line keeps its leading spaces).
  readonly isNextLineStart: boolean
}

// The result of scanning a font image: the glyph table and the width of the space (0x1001e190).
export type GlyphScan = {
  readonly glyphs: readonly FontGlyph[]
  readonly spaceWidth: number
}

export type InverseScale = {
  readonly x: number
  readonly y: number
}

export type ClippedGlyphRectangles = {
  readonly source: TextRectangle
  readonly destination: TextRectangle
}

export type GlyphRunParameters = {
  readonly font: BitmapFont
  readonly glyphIndices: readonly number[]
  readonly surface: TextSurface
  readonly x: number
  readonly y: number
  readonly scale: TextScale
  readonly clip: TextRectangle | null
  readonly arithmetic: FloatArithmetic
}

export type GlyphRun = {
  readonly commands: readonly FontDrawCommand[]
  // What 0x00409300 returns: the x where the next glyph would start.
  readonly nextX: number
}

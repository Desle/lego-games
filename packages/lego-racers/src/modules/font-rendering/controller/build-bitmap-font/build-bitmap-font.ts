import type { Bitmap } from '../../../bitmap/index.ts'
import type { FontDefinition } from '../../../font-database/index.ts'
import {
  IncompleteFontImageError,
  MissingFontCharactersError,
} from '../../types/font-rendering-errors/font-rendering-errors.ts'
import type { BitmapFont, FontGlyph } from '../../types/font-rendering.types.ts'

const SPACE_CODE = 0x20

const getBytesPerPixel = (bitmap: Bitmap): number => bitmap.bitsPerPixel >> 3

// The pixel at (column, row) as the font scanner compares it: the palette index at 4 and 8 bits,
// the stored bytes (blue first) packed little endian above that.
const getPixelBytes = (bitmap: Bitmap, column: number, row: number): readonly number[] => {
  const rowStart = row * bitmap.stride
  if (bitmap.bitsPerPixel === 4) {
    const packed = bitmap.pixels[rowStart + (column >> 1)] ?? 0
    return [column % 2 === 0 ? packed >> 4 : packed & 0xf]
  }
  const bytesPerPixel = getBytesPerPixel(bitmap)
  const bytes: number[] = []
  for (let byteIndex = 0; byteIndex < bytesPerPixel; byteIndex++) {
    bytes.push(bitmap.pixels[rowStart + column * bytesPerPixel + byteIndex] ?? 0)
  }
  return bytes
}

// 0x1001e420: column 0 of every row is the separator; at 32 bits the mask `(1 << 32) - 1` is 0 on x86.
const getSeparatorColumn = (bitmap: Bitmap): readonly (readonly number[])[] =>
  Array.from({ length: bitmap.height }, (_, row) => {
    const bytes = getPixelBytes(bitmap, 0, row)
    return bitmap.bitsPerPixel === 32 ? bytes.map(() => 0) : bytes
  })

// 0x1001e4c0: every row of the column equals the separator.
const getIsSeparatorColumn = (
  bitmap: Bitmap,
  column: number,
  separator: readonly (readonly number[])[]
): boolean => {
  for (let row = 0; row < bitmap.height; row++) {
    const expected = separator[row] ?? []
    const actual = getPixelBytes(bitmap, column, row)
    for (let byteIndex = 0; byteIndex < expected.length; byteIndex++) {
      if (actual[byteIndex] !== expected[byteIndex]) return false
    }
  }
  return true
}

// 0x1001e190 and the sort of 0x1001e070 (qsort with 0x1001f140, ascending by code).
const getGlyphs = (
  bitmap: Bitmap,
  characters: readonly number[],
  fontName: string
): { readonly glyphs: readonly FontGlyph[]; readonly spaceWidth: number } => {
  const separator = getSeparatorColumn(bitmap)
  let column = 0
  while (column < bitmap.width && getIsSeparatorColumn(bitmap, column, separator)) column += 1
  const spaceWidth = column
  const glyphs: FontGlyph[] = [Object.freeze({ code: SPACE_CODE, imageX: 0, width: spaceWidth })]
  // The first glyph starts one column after the leading separators, as the original's `uVar8 + 1`.
  column += 1
  characters.forEach((code, index) => {
    if (index > 0) {
      while (column < bitmap.width && getIsSeparatorColumn(bitmap, column, separator)) column += 1
    }
    const start = column
    while (column < bitmap.width && !getIsSeparatorColumn(bitmap, column, separator)) column += 1
    const width = column - start
    if (width === 0) throw new IncompleteFontImageError(fontName)
    glyphs.push(Object.freeze({ code, imageX: start, width }))
  })
  return {
    glyphs: Object.freeze(glyphs.toSorted((left, right) => left.code - right.code)),
    spaceWidth,
  }
}

// GolDP.dll 0x1001df80 and 0x1001e070: the glyph table of a font from its FDB entry and its image.
export const buildBitmapFont = (definition: FontDefinition, bitmap: Bitmap): BitmapFont => {
  if (definition.characters === null) throw new MissingFontCharactersError(definition.name)
  const { glyphs, spaceWidth } = getGlyphs(bitmap, definition.characters, definition.name)
  const isKeyed = (definition.flags & 0x20) !== 0
  return Object.freeze({
    name: definition.name,
    lineHeight: bitmap.height,
    spaceWidth,
    letterSpacing: definition.keyword2cValue ?? 0,
    glyphs,
    colorKey: isKeyed ? Object.freeze([...definition.keyword2aBytes] as const) : null,
    tint: definition.keyword2dBytes,
    imageWidth: bitmap.width,
  })
}

import { decodeBitmap } from '../../../bitmap/index.ts'
import type { Bitmap } from '../../../bitmap/index.ts'
import { parseFontDatabase } from '../../../font-database/index.ts'
import type { FontDefinition } from '../../../font-database/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { IncompleteFontImageError } from '../../types/font-rendering-errors/font-rendering-errors.ts'
import { buildBitmapFont } from './build-bitmap-font.ts'

const getBitmap = (rows: readonly string[]): Bitmap => {
  const width = rows[0]?.length ?? 0
  const pixels = new Uint8Array(width * rows.length)
  rows.forEach((row, rowIndex) => {
    for (let column = 0; column < width; column++) {
      pixels[rowIndex * width + column] = row.charCodeAt(column) - 0x30
    }
  })
  return {
    width,
    height: rows.length,
    bitsPerPixel: 8,
    colorCount: 4,
    palette: new Uint8Array(256 * 4),
    stride: width,
    pixels,
  }
}

const getDefinition = (characters: readonly number[] | null): FontDefinition => ({
  name: 'test',
  flags: 0x828,
  keyword2aBytes: [0, 0, 0],
  characters,
  keyword2cValue: -1,
  keyword2dBytes: [255, 255, 255],
})

describe('buildBitmapFont', () => {
  it('counts the leading separator columns as the space and starts the first glyph one column later', () => {
    // Arrange
    const bitmap = getBitmap(['000111011', '000101011'])

    // Act
    const font = buildBitmapFont(getDefinition([0x41, 0x42]), bitmap)

    // Assert
    expect(font.spaceWidth).toBe(3)
    expect(font.lineHeight).toBe(2)
    expect(font.letterSpacing).toBe(-1)
    expect(font.glyphs).toEqual([
      { code: 0x20, imageX: 0, width: 3 },
      { code: 0x41, imageX: 4, width: 2 },
      { code: 0x42, imageX: 7, width: 2 },
    ])
  })

  it('sorts the glyph table by character code', () => {
    // Arrange
    const bitmap = getBitmap(['0001101101', '0001101101'])

    // Act
    const font = buildBitmapFont(getDefinition([0x5a, 0x41]), bitmap)

    // Assert
    expect(font.glyphs.map((glyph) => glyph.code)).toEqual([0x20, 0x41, 0x5a])
    expect(font.glyphs.map((glyph) => glyph.imageX)).toEqual([0, 6, 4])
  })

  it('fails when a character has no columns left', () => {
    // Arrange
    const bitmap = getBitmap(['000110', '000110'])

    // Act
    const act = () => buildBitmapFont(getDefinition([0x41, 0x42]), bitmap)

    // Assert
    expect(act).toThrow(IncompleteFontImageError)
  })

  it('keeps the colour key only when the FDB set the colour key flag', () => {
    // Arrange
    const bitmap = getBitmap(['0011', '0011'])
    const unkeyed = { ...getDefinition([0x41]), flags: 0x8 }

    // Act
    const keyed = buildBitmapFont(getDefinition([0x41]), bitmap)
    const plain = buildBitmapFont(unkeyed, bitmap)

    // Assert
    expect(keyed.colorKey).toEqual([0, 0, 0])
    expect(plain.colorKey).toBeNull()
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'builds every font of every FDB in the original LEGO.JAM whose image is there',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths()
      const fontPaths = paths.filter((path) => path.toUpperCase().endsWith('.FDB'))
      const builtNames: string[] = []
      const incompleteNames: string[] = []

      // Act
      for (const fontPath of fontPaths) {
        const directory = fontPath.slice(0, fontPath.lastIndexOf('\\'))
        for (const definition of parseFontDatabase(archive.readFile(fontPath)).fonts) {
          const imagePath = `${directory}\\${definition.name.toUpperCase()}.BMP`
          if (!paths.includes(imagePath)) continue
          const bitmap = decodeBitmap(archive.readFile(imagePath))
          try {
            const font = buildBitmapFont(definition, bitmap)
            builtNames.push(`${fontPath}:${font.name}:${String(font.glyphs.length)}`)
          } catch (error) {
            if (!(error instanceof IncompleteFontImageError)) throw error
            incompleteNames.push(`${fontPath}:${definition.name}`)
          }
        }
      }

      // Assert
      expect(fontPaths).toHaveLength(20)
      expect(builtNames).toContain('MENUDATA\\ENGLISH\\GFONTS.FDB:font_ths:64')
      expect(builtNames).toContain('GAMEDATA\\COMMON\\ENGLISH\\LEGOFNTS.FDB:ignum:15')
      expect(builtNames.length).toBeGreaterThanOrEqual(24)
      // The Danish menu font lists 45 characters and its image holds 44 (font-rendering.md, open findings).
      expect(incompleteNames).toEqual(['MENUDATA\\DANISH\\GFONTS.FDB:fontmenu'])
    }
  )
})

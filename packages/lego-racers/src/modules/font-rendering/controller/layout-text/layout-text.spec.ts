import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { BitmapFont, TextLayoutParameters } from '../../types/font-rendering.types.ts'
import { getGlyphIndex } from '../get-glyph-index/get-glyph-index.ts'
import { getTextWidth } from '../measure-text/get-text-width.ts'
import { getWrappedTextSize } from '../measure-text/get-wrapped-text-size.ts'
import { layoutText } from './layout-text.ts'

const font: BitmapFont = {
  name: 'test',
  lineHeight: 10,
  spaceWidth: 4,
  letterSpacing: 1,
  glyphs: [
    { code: 0x20, imageX: 0, width: 4 },
    { code: 0x41, imageX: 5, width: 6 },
    { code: 0x42, imageX: 12, width: 8 },
  ],
  colorKey: null,
  tint: [255, 255, 255],
  imageWidth: 30,
}
const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const codes = (text: string): readonly number[] =>
  Array.from(text, (letter) => letter.charCodeAt(0))

const getParameters = (text: string, overrides: Partial<TextLayoutParameters> = {}) => ({
  font,
  text: codes(text),
  surface: { width: 200, height: 100 },
  x: 10,
  y: 20,
  maximumWidth: 100,
  lineGap: 0,
  scale: { x: 1, y: 1 },
  clip: null,
  alignment: 'left' as const,
  arithmetic,
  ...overrides,
})

describe('getGlyphIndex', () => {
  it('finds a code and answers the first glyph for a missing one', () => {
    // Arrange / Act
    const found = getGlyphIndex(font, 0x42)
    const missing = getGlyphIndex(font, 0x5a)

    // Assert
    expect(found).toBe(2)
    expect(missing).toBe(0)
  })
})

describe('getTextWidth', () => {
  it('adds each advance and drops the last letter spacing', () => {
    // Arrange / Act
    const size = getTextWidth(font, codes('AB A'))

    // Assert
    expect(size).toEqual({ width: 7 + 9 + 5 + 7 - 1, height: 10 })
  })
})

describe('layoutText', () => {
  it('advances by the glyph width and the letter spacing', () => {
    // Arrange / Act
    const commands = layoutText(getParameters('AB'))

    // Assert
    expect(commands).toEqual([
      {
        code: 0x41,
        sourceX: 5,
        sourceY: 0,
        sourceWidth: 6,
        sourceHeight: 10,
        destination: { left: 10, top: 20, right: 16, bottom: 30 },
      },
      {
        code: 0x42,
        sourceX: 12,
        sourceY: 0,
        sourceWidth: 8,
        sourceHeight: 10,
        destination: { left: 17, top: 20, right: 25, bottom: 30 },
      },
    ])
  })

  it('draws a space as its own blank glyph', () => {
    // Arrange / Act
    const commands = layoutText(getParameters('A B'))

    // Assert
    expect(commands.map((command) => command.code)).toEqual([0x41, 0x20, 0x42])
    expect(commands[2]?.destination.left).toBe(10 + 7 + 5)
  })

  it('breaks lines at spaces and moves down by the scaled line height', () => {
    // Arrange / Act
    const commands = layoutText(getParameters('AA BB', { maximumWidth: 20 }))

    // Assert
    expect(commands.map((command) => command.destination.top)).toEqual([20, 20, 30, 30])
    expect(commands.map((command) => command.destination.left)).toEqual([10, 17, 10, 19])
  })

  it('centres a line by half of the unused width, in unscaled pixels', () => {
    // Arrange / Act
    const commands = layoutText(getParameters('A', { alignment: 'center', maximumWidth: 30 }))

    // Assert
    expect(commands[0]?.destination.left).toBe(10 + ((30 - 7) >> 1))
  })

  it('cuts glyphs at the clip rectangle and the source with them', () => {
    // Arrange / Act
    const commands = layoutText(
      getParameters('B', { clip: { left: 0, top: 0, right: 14, bottom: 100 } })
    )

    // Assert
    expect(commands).toEqual([
      {
        code: 0x42,
        sourceX: 12,
        sourceY: 0,
        sourceWidth: 4,
        sourceHeight: 10,
        destination: { left: 10, top: 20, right: 14, bottom: 30 },
      },
    ])
  })
})

describe('getWrappedTextSize', () => {
  it('measures the widest line and one line height per line', () => {
    // Arrange / Act
    const size = getWrappedTextSize({
      font,
      text: codes('AA BB'),
      maximumWidth: 20,
      firstLineOffset: 0,
      scale: { x: 1, y: 1 },
      arithmetic,
    })

    // Assert
    expect(size).toEqual({ width: 17, height: 20 })
  })
})

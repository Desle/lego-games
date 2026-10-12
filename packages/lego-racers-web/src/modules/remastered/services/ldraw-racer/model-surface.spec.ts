import type { SceneBitmap } from '@lego-games/lego-racers/scene'
import {
  getAverageColor,
  getColorShares,
  getDominantBrightColor,
  getDominantColor,
} from './model-surface.ts'

// A bitmap of the given pixels (RGBA), `width` pixels to a row.
const createBitmap = (width: number, pixels: readonly (readonly number[])[]): SceneBitmap => ({
  width,
  height: pixels.length / width,
  colors: Uint8Array.from(pixels.flat()),
})

const RED = [255, 0, 0, 255]
const BLUE = [0, 0, 255, 255]
const BLACK = [0, 0, 0, 255]
const CLEAR = [9, 9, 9, 0]

describe('getAverageColor', () => {
  it('averages the opaque pixels', () => {
    // Arrange
    const bitmap = createBitmap(2, [RED, BLUE, CLEAR, RED])

    // Act
    const color = getAverageColor(bitmap)

    // Assert
    expect(color).toBe(0xaa0055)
  })

  it('leaves out the pixels darker than the threshold', () => {
    // Arrange
    const bitmap = createBitmap(2, [RED, BLACK, BLACK, BLACK])

    // Act
    const color = getAverageColor(bitmap, 90)

    // Assert
    expect(color).toBe(0xff0000)
  })

  it('averages a part of the bitmap by fractions of its size', () => {
    // Arrange
    const bitmap = createBitmap(2, [RED, BLUE, RED, BLUE])

    // Act
    const color = getAverageColor(bitmap, 0, { left: 0.5, top: 0, right: 1, bottom: 1 })

    // Assert
    expect(color).toBe(0x0000ff)
  })

  it('has no colour for a bitmap with nothing opaque', () => {
    // Arrange
    const bitmap = createBitmap(2, [CLEAR, CLEAR])

    // Act
    const color = getAverageColor(bitmap)

    // Assert
    expect(color).toBeNull()
  })
})

describe('getColorShares', () => {
  it('lists the colours of the opaque pixels, most common first, with their shares', () => {
    // Arrange
    const bitmap = createBitmap(2, [RED, RED, RED, BLUE, CLEAR, CLEAR])

    // Act
    const shares = getColorShares(bitmap)

    // Assert
    expect(shares).toEqual([
      { color: 0xff0000, share: 0.75 },
      { color: 0x0000ff, share: 0.25 },
    ])
  })
})

describe('getDominantColor', () => {
  it('takes the colour that covers most of a part of the bitmap', () => {
    // Arrange
    const bitmap = createBitmap(2, [RED, BLUE, RED, BLUE])

    // Act
    const colors = [
      getDominantColor(bitmap, { left: 0, top: 0, right: 0.5, bottom: 1 }),
      getDominantColor(bitmap),
    ]

    // Assert
    expect(colors).toEqual([0xff0000, 0xff0000])
  })
})

describe('getDominantBrightColor', () => {
  it('takes the most common colour that is not dark, however much dark there is', () => {
    // Arrange
    const bitmap = createBitmap(2, [BLACK, BLACK, BLACK, BLUE, RED, BLUE])

    // Act
    const color = getDominantBrightColor(bitmap, 90)

    // Assert
    expect(color).toBe(0x0000ff)
  })

  it('has no colour when everything is dark', () => {
    // Arrange
    const bitmap = createBitmap(2, [BLACK, BLACK])

    // Act
    const color = getDominantBrightColor(bitmap, 90)

    // Assert
    expect(color).toBeNull()
  })
})

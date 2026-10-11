import type { Bitmap } from '../../../bitmap/index.ts'
import { getFontImagePixels } from './get-font-image-pixels.ts'

const getBitmap = (): Bitmap => {
  const palette = new Uint8Array(256 * 4)
  palette.set([0, 0, 0, 255, 0, 0, 0, 255, 200, 100, 50, 255], 0)
  return {
    width: 3,
    height: 1,
    bitsPerPixel: 8,
    colorCount: 3,
    palette,
    stride: 4,
    pixels: new Uint8Array([0, 1, 2, 0]),
  }
}

describe('getFontImagePixels', () => {
  it('makes only the first palette entry that equals the colour key transparent', () => {
    // Arrange
    const bitmap = getBitmap()

    // Act
    const pixels = getFontImagePixels(bitmap, [0, 0, 0])

    // Assert
    expect(Array.from(pixels)).toEqual([0, 0, 0, 0, 0, 0, 0, 255, 200, 100, 50, 255])
  })

  it('keeps every pixel opaque without a colour key', () => {
    // Arrange
    const bitmap = getBitmap()

    // Act
    const pixels = getFontImagePixels(bitmap, null)

    // Assert
    expect(Array.from(pixels).filter((_, index) => index % 4 === 3)).toEqual([255, 255, 255])
  })
})

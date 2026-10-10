import { getColorKeyPaletteIndex, getKeyedPalette, getKeyedTrueColors } from './texture-colors.ts'

const createBitmap = (bitsPerPixel: number) => {
  const palette = new Uint8Array(256 * 4)
  palette.set([10, 20, 30, 255, 0, 0, 0, 255, 0, 0, 0, 255], 0)
  return { width: 1, height: 1, bitsPerPixel, palette }
}

describe('texture colour key', () => {
  it('finds the first palette entry whose colour equals the key', () => {
    // Arrange
    const bitmap = createBitmap(4)

    // Act
    const index = getColorKeyPaletteIndex(bitmap, [0, 0, 0])

    // Assert
    expect(index).toBe(1)
    expect(getColorKeyPaletteIndex(bitmap, [1, 2, 3])).toBe(-1)
    expect(getColorKeyPaletteIndex(createBitmap(24), [0, 0, 0])).toBe(-1)
  })

  it('makes only the keyed palette entry transparent', () => {
    // Arrange
    const bitmap = createBitmap(8)

    // Act
    const palette = getKeyedPalette(bitmap, [10, 20, 30])

    // Assert
    expect([...palette.subarray(0, 8)]).toEqual([10, 20, 30, 0, 0, 0, 0, 255])
    expect(bitmap.palette[3]).toBe(255)
  })

  it('makes matching true-colour pixels transparent', () => {
    // Arrange
    const colors = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255])

    // Act
    const keyed = getKeyedTrueColors(colors, [4, 5, 6])

    // Assert
    expect([...keyed]).toEqual([1, 2, 3, 255, 4, 5, 6, 0])
  })
})

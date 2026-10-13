import { getMeanPictureColor, getNearestBrickColorIndex } from './brick-body-color.ts'

const WHITE_INDEX = 1
const BLACK_INDEX = 0

describe('getMeanPictureColor', () => {
  it('averages the opaque pixels and leaves the colour-keyed ones out', () => {
    // Arrange
    const bitmap = {
      width: 3,
      height: 1,
      colors: Uint8Array.from([200, 100, 0, 255, 100, 50, 0, 255, 255, 255, 255, 0]),
    }

    // Act
    const color = getMeanPictureColor(bitmap)

    // Assert
    expect(color).toBe(0x964b00)
  })
})

describe('getNearestBrickColorIndex', () => {
  it('takes a near white print for a white brick and a dark one for black', () => {
    // Arrange
    const nearWhite = 0xfefefe
    const nearBlack = 0x2b2b2b

    // Act
    const white = getNearestBrickColorIndex(nearWhite)
    const black = getNearestBrickColorIndex(nearBlack)

    // Assert
    expect(white).toBe(WHITE_INDEX)
    expect(black).toBe(BLACK_INDEX)
  })
})

import { getBrickColorIndex } from './body-colors.ts'

describe('getBrickColorIndex', () => {
  it('tells the greys apart by brightness', () => {
    // Arrange
    const shades = [9, 112, 173, 255]

    // Act
    const indices = shades.map((shade) => getBrickColorIndex(shade, shade, shade))

    // Assert
    expect(indices).toEqual([0, 4, 3, 1])
  })

  it('tells the colours apart by hue', () => {
    // Arrange / Act
    const indices = [
      getBrickColorIndex(222, 55, 55),
      getBrickColorIndex(25, 128, 25),
      getBrickColorIndex(37, 61, 223),
      getBrickColorIndex(255, 223, 0),
    ]

    // Assert
    expect(indices).toEqual([5, 8, 9, 7])
  })
})

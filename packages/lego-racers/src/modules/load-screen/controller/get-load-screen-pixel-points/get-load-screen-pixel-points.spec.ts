import { getLoadScreenPixelPoints } from './get-load-screen-pixel-points.ts'

describe('getLoadScreenPixelPoints', () => {
  it('scales by the surface size and truncates toward zero, so float32 0.9 of 480 is 431', () => {
    // Arrange
    const points = [
      [Math.fround(0.12), Math.fround(0.9)],
      [-0.5, 0.999],
    ] as const

    // Act
    const pixels = getLoadScreenPixelPoints(points, 640, 480)

    // Assert
    expect(pixels).toEqual([
      [76, 431],
      [-320, 479],
    ])
  })
})

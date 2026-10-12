import { getNativeMenuSurfaceScale } from './menu-surface.ts'

describe('getNativeMenuSurfaceScale', () => {
  it('follows the device pixels in steps, never below the design and never past the cap', () => {
    // Arrange
    const requested = [0.5, 2.1, 3, 40, Number.NaN]

    // Act
    const scales = requested.map(getNativeMenuSurfaceScale)

    // Assert
    expect(scales).toEqual([1, 2.25, 3, 8, 1])
  })
})

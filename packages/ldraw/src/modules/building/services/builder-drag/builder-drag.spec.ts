import {
  getDominantAxis,
  getIsAlongAxis,
  getIsVertical,
  getPlateOffset,
  getRayHeight,
  lockToAxis,
} from './builder-drag.ts'

describe('lockToAxis', () => {
  it('holds a drag to the ground axis it goes most along', () => {
    // Arrange
    const along = [27, 0, -8] as const
    const across = [3, 0, -41] as const

    // Act
    const locked = [along, across].map((offset) => lockToAxis(offset, getDominantAxis(offset)))

    // Assert
    expect(locked).toEqual([
      [27, 0, 0],
      [0, 0, -41],
    ])
  })

  it('lets a move along the line rise but not leave it', () => {
    // Arrange
    const moves = [
      [40, -24, 0],
      [40, 0, 20],
    ] as const

    // Act
    const allowed = moves.map((offset) => getIsAlongAxis(offset, 0))

    // Assert
    expect(allowed).toEqual([true, false])
  })
})

describe('getPlateOffset', () => {
  it('moves up or down by whole plates', () => {
    // Arrange
    const heights = [-3, -13, 5, 23.9]

    // Act
    const offsets = heights.map((height) => getPlateOffset(0, height))

    // Assert
    expect(offsets).toEqual([
      [0, 0, 0],
      [0, -16, 0],
      [0, 8, 0],
      [0, 24, 0],
    ])
    expect(offsets.every(getIsVertical)).toBe(true)
  })
})

describe('getRayHeight', () => {
  it('reads the height the cursor points at above the grabbed point, facing the camera', () => {
    // Arrange
    const origin = [0, -100, 100] as const
    const direction = [0, 0.6, -0.8] as const

    // Act
    const height = getRayHeight(origin, direction, [30, 0, 0])
    const fromAbove = getRayHeight(origin, [0, 1, 0], [30, 0, 0])

    // Assert
    expect(height).toBeCloseTo(-25)
    expect(fromAbove).toBeNull()
  })
})

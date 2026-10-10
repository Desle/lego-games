import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { findNearestRacerInCone } from './racer-cone-query.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const QUERY = Object.freeze({
  origin: { x: 0, y: 0, z: 0 },
  direction: { x: 1, y: 0, z: 0 },
  minimumDistanceSquared: 0,
  maximumDistanceSquared: 169,
  minimumCosine: Math.fround(0.3),
})

describe('findNearestRacerInCone', () => {
  it('picks the nearest racer in the cone and range, never the asker at the origin', () => {
    // Arrange
    const racerPositions = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 5, y: 1, z: 0 },
      { x: -2, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
    ]

    // Act
    const found = findNearestRacerInCone(SINGLE, { ...QUERY, racerPositions })

    // Assert
    expect(found).toBe(2)
  })

  it('returns null when nobody is inside', () => {
    // Arrange
    const racerPositions = [{ x: 0, y: 5, z: 0 }]

    // Act
    const found = findNearestRacerInCone(SINGLE, { ...QUERY, racerPositions })

    // Assert
    expect(found).toBeNull()
  })
})

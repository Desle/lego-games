import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { ConeQuery } from '../power-ups.types.ts'
import {
  COMPUTER_PROJECTILE_WINDOW,
  getFarthestInCone,
  getNearestInCone,
  getNextInCone,
} from './cone-query.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const getQuery = (positions: readonly (readonly [number, number, number])[]): ConeQuery =>
  Object.freeze({
    origin: { x: 0, y: 0, z: 0 },
    direction: { x: 1, y: 0, z: 0 },
    window: COMPUTER_PROJECTILE_WINDOW,
    targets: positions.map(([x, y, z]) => ({ position: { x, y, z } })),
  })

describe('getNearestInCone', () => {
  it('skips the asker (distance 0), racers behind and racers beyond 250 units (0x0043ca60)', () => {
    // Arrange
    const query = getQuery([
      [0, 0, 0],
      [-50, 0, 0],
      [300, 0, 0],
      [120, 0, 0],
      [60, 5, 0],
    ])

    // Act
    const nearest = getNearestInCone(SINGLE, query)

    // Assert
    expect(nearest).toBe(4)
  })

  it('needs a cosine of at least 0.96', () => {
    // Arrange: 60, 20 has a cosine of 0.9487.
    const query = getQuery([[60, 20, 0]])

    // Act
    const nearest = getNearestInCone(SINGLE, query)

    // Assert
    expect(nearest).toBe(-1)
  })

  it('accepts exactly 10 and exactly 250 units', () => {
    // Arrange
    const query = getQuery([
      [250, 0, 0],
      [10, 0, 0],
    ])

    // Act
    const results = [getNearestInCone(SINGLE, query), getFarthestInCone(SINGLE, query)]

    // Assert
    expect(results).toEqual([1, 0])
  })
})

describe('getNextInCone', () => {
  it('returns the first racer after the given index in the cone (0x0043c6e0, 0x0043c7f0)', () => {
    // Arrange
    const query = getQuery([
      [50, 0, 0],
      [-50, 0, 0],
      [80, 0, 0],
    ])

    // Act
    const results = [
      getNextInCone(SINGLE, query, -1),
      getNextInCone(SINGLE, query, 0),
      getNextInCone(SINGLE, query, 2),
    ]

    // Assert
    expect(results).toEqual([0, 2, -1])
  })
})

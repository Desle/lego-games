import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { CollisionTriangle } from '../collision.types.ts'
import { getIsPointInTriangle, getTriangleSegmentResult } from './triangle-test.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

// Counter-clockwise from above in x, y; normal +z; plane z = 2.
const FLOOR: CollisionTriangle = {
  vertices: [
    { x: 0, y: 0, z: 2 },
    { x: 4, y: 0, z: 2 },
    { x: 0, y: 4, z: 2 },
  ],
  normal: { x: 0, y: 0, z: 1 },
  planeDistance: -2,
}

// The same triangle standing in the x = 3 plane (normal +x), so y and z are kept.
const WALL: CollisionTriangle = {
  vertices: [
    { x: 3, y: 0, z: 0 },
    { x: 3, y: 4, z: 0 },
    { x: 3, y: 0, z: 4 },
  ],
  normal: { x: 1, y: 0, z: 0 },
  planeDistance: -3,
}

describe('getIsPointInTriangle', () => {
  it('tests in the plane that drops the largest normal axis, for either winding', () => {
    // Arrange
    const reversed: CollisionTriangle = {
      ...FLOOR,
      vertices: [FLOOR.vertices[0], FLOOR.vertices[2], FLOOR.vertices[1]],
    }

    // Act
    const results = [
      getIsPointInTriangle(SINGLE, { x: 1, y: 1, z: 99 }, FLOOR),
      getIsPointInTriangle(SINGLE, { x: 3, y: 3, z: 2 }, FLOOR),
      getIsPointInTriangle(SINGLE, { x: 1, y: 1, z: 2 }, reversed),
      getIsPointInTriangle(SINGLE, { x: 3, y: 1, z: 1 }, WALL),
      getIsPointInTriangle(SINGLE, { x: 3, y: 3, z: 3 }, WALL),
    ]

    // Assert
    expect(results).toEqual([true, false, true, true, false])
  })

  it('counts points on an edge as inside', () => {
    // Arrange
    const onEdge = { x: 2, y: 0, z: 2 }

    // Act
    const isInside = getIsPointInTriangle(SINGLE, onEdge, FLOOR)

    // Assert
    expect(isInside).toBe(true)
  })
})

describe('getTriangleSegmentResult', () => {
  it('returns the crossing point of a segment through the plane and whether it is inside', () => {
    // Arrange
    const start = { x: 1, y: 1, z: 5 }
    const end = { x: 1, y: 1, z: 1 }

    // Act
    const result = getTriangleSegmentResult(SINGLE, FLOOR, start, end)

    // Assert
    expect(result).toEqual({ isInside: true, crossingPoint: { x: 1, y: 1, z: 2 } })
  })

  it('reports a crossing outside the triangle, and no crossing for a segment on one side', () => {
    // Arrange
    const outside = getTriangleSegmentResult(
      SINGLE,
      FLOOR,
      { x: 5, y: 5, z: 3 },
      { x: 5, y: 5, z: 1 }
    )

    // Act
    const above = getTriangleSegmentResult(
      SINGLE,
      FLOOR,
      { x: 1, y: 1, z: 5 },
      { x: 1, y: 1, z: 3 }
    )

    // Assert
    expect(outside).toEqual({ isInside: false, crossingPoint: { x: 5, y: 5, z: 2 } })
    expect(above).toEqual({ isInside: false, crossingPoint: undefined })
  })
})

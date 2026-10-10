import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { CollisionVolume } from '../collision.types.ts'
import { getSegmentQueryResult } from './segment-query.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const NO_CHILD = 0xffff

// A 10 × 10 floor at z = 0 in one node: two triangles whose (v2 - v1) × (v0 - v1) points up.
const FLOOR: CollisionVolume = {
  nodes: [
    {
      normal: { x: 0, y: 0, z: 1 },
      firstTriangleIndex: 0,
      triangleCount: 2,
      positiveChildIndex: NO_CHILD,
      negativeChildIndex: NO_CHILD,
    },
  ],
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 10, z: 0 },
    { x: 0, y: 10, z: 0 },
  ],
  triangles: [
    { vertexIndices: [0, 1, 2], materialIndex: 0 },
    { vertexIndices: [0, 2, 3], materialIndex: 1 },
  ],
  materialNames: ['road', 'grass'],
}

const point = (x: number, y: number, z: number): Vector3 => ({ x, y, z })

describe('getSegmentQueryResult', () => {
  it('finds the triangle a segment crosses from the front, with the plane fraction', () => {
    // Arrange
    const start = point(5, 2, 5)
    const end = point(5, 2, -15)

    // Act
    const { intersection } = getSegmentQueryResult(SINGLE, FLOOR, start, end)

    // Assert
    expect(intersection?.point).toEqual({ x: 5, y: 2, z: 0 })
    expect(intersection?.fraction).toBe(0.25)
    expect(intersection?.materialIndex).toBe(0)
    expect(intersection?.triangle.normal).toEqual({ x: 0, y: -0, z: 1 })
    expect(intersection?.triangle.vertices[2]).toEqual({ x: 10, y: 10, z: 0 })
  })

  it('falls back to the last triangle crossed from behind (0x004043eb)', () => {
    // Arrange: from below, the only triangle under (2, 5) faces away from the segment.
    const start = point(2, 5, -5)
    const end = point(2, 5, 5)

    // Act
    const { intersection } = getSegmentQueryResult(SINGLE, FLOOR, start, end)

    // Assert
    expect(intersection?.materialIndex).toBe(1)
    expect(intersection?.triangle.normal).toEqual({ x: 0, y: 0, z: 1 })
    expect(intersection?.point).toEqual({ x: 2, y: 5, z: 0 })
  })

  it('misses outside every triangle but leaves the crossing point behind', () => {
    // Arrange
    const start = point(20, 20, 5)
    const end = point(20, 20, -5)

    // Act
    const result = getSegmentQueryResult(SINGLE, FLOOR, start, end)

    // Assert
    expect(result.intersection).toBeUndefined()
    expect(result.lastCrossingPoint).toEqual({ x: 20, y: 20, z: 0 })
  })

  it('misses a segment that stays on one side of every plane', () => {
    // Arrange
    const start = point(5, 2, 5)
    const end = point(5, 2, 1)

    // Act
    const result = getSegmentQueryResult(SINGLE, FLOOR, start, end)

    // Assert
    expect(result).toEqual({ intersection: undefined, lastCrossingPoint: undefined })
  })
})

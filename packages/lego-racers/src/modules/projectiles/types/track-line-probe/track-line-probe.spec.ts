import type { CollisionVolume } from '../../../collision/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { createTrackLineProbe } from './track-line-probe.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const NO_CHILD = 0xffff

// One 10 x 10 floor at z = 0 whose second triangle is a pass-through material.
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
  materialNames: ['road', 'ghost'],
}

describe('createTrackLineProbe', () => {
  const probe = createTrackLineProbe(SINGLE, FLOOR, (materialIndex) => materialIndex === 1)

  it('returns the hit point and the surface normal (0x0041f730)', () => {
    // Arrange
    const start = { x: 5, y: 2, z: 5 }
    const end = { x: 5, y: 2, z: -15 }

    // Act
    const hit = probe(start, end)

    // Assert
    expect(hit?.point).toEqual({ x: 5, y: 2, z: 0 })
    expect(hit?.normal.z).toBe(1)
  })

  it('treats a hit on a material with flag 0x20000 as a miss', () => {
    // Arrange: (2, 5) lies under the second triangle.
    const start = { x: 2, y: 5, z: 5 }
    const end = { x: 2, y: 5, z: -15 }

    // Act
    const hit = probe(start, end)

    // Assert
    expect(hit).toBeNull()
  })

  it('misses when the segment stays above the floor', () => {
    // Arrange
    const start = { x: 5, y: 2, z: 5 }
    const end = { x: 5, y: 2, z: 3 }

    // Act
    const hit = probe(start, end)

    // Assert
    expect(hit).toBeNull()
  })
})

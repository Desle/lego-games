import type { CollisionVolume } from '../../../collision/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { createTrackLineProbe } from './track-line-probe.ts'
import type { ProbeSurface } from './track-line-probe.types.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const NO_CHILD = 0xffff

const ROAD: ProbeSurface = { isPassThrough: false, signalIdentifier: null }
const GHOST: ProbeSurface = { isPassThrough: true, signalIdentifier: null }
const BARREL: ProbeSurface = { isPassThrough: false, signalIdentifier: 7 }
const OPENED_BARREL: ProbeSurface = { isPassThrough: true, signalIdentifier: 7 }

// One 10 x 10 floor at z = 0 whose second triangle has the material at index 1.
const createFloor = (): CollisionVolume => ({
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
  materialNames: ['road', 'second'],
})

const createProbe = (second: ProbeSurface) =>
  createTrackLineProbe(SINGLE, createFloor(), (materialIndex) =>
    materialIndex === 1 ? second : ROAD
  )

// (5, 2) lies over the first triangle, (2, 5) over the second.
const FIRST_START = { x: 5, y: 2, z: 5 }
const FIRST_END = { x: 5, y: 2, z: -15 }
const SECOND_START = { x: 2, y: 5, z: 5 }
const SECOND_END = { x: 2, y: 5, z: -15 }

describe('createTrackLineProbe', () => {
  it('returns the hit point and the surface normal (0x0041f730)', () => {
    // Arrange
    const probe = createProbe(GHOST)

    // Act
    const hit = probe(FIRST_START, FIRST_END)

    // Assert
    expect(hit?.point).toEqual({ x: 5, y: 2, z: 0 })
    expect(hit?.normal.z).toBe(1)
  })

  it('treats a hit on a material with flag 0x20000 as a miss', () => {
    // Arrange
    const probe = createProbe(GHOST)

    // Act
    const hit = probe(SECOND_START, SECOND_END)

    // Assert
    expect(hit).toBeNull()
  })

  it('misses when the segment stays above the floor', () => {
    // Arrange
    const probe = createProbe(GHOST)

    // Act
    const hit = probe(FIRST_START, { x: 5, y: 2, z: 3 })

    // Assert
    expect(hit).toBeNull()
  })

  it('starts the signal of a hit material with flag 0x10 at the hit point and still hits it', () => {
    // Arrange
    const probe = createProbe(BARREL)
    const signals: { readonly identifier: number; readonly point: Vector3 }[] = []

    // Act
    const hit = probe(SECOND_START, SECOND_END, (identifier, point) =>
      signals.push({ identifier, point })
    )

    // Assert
    expect(hit?.point).toEqual({ x: 2, y: 5, z: 0 })
    expect(signals).toEqual([{ identifier: 7, point: { x: 2, y: 5, z: 0 } }])
  })

  it('signals before a pass-through hit is dropped, so an opened barrier still signals', () => {
    // Arrange
    const probe = createProbe(OPENED_BARREL)
    const identifiers: number[] = []

    // Act
    const hit = probe(SECOND_START, SECOND_END, (identifier) => identifiers.push(identifier))

    // Assert
    expect(hit).toBeNull()
    expect(identifiers).toEqual([7])
  })

  it('signals nothing for a material without flag 0x10', () => {
    // Arrange
    const probe = createProbe(BARREL)
    const identifiers: number[] = []

    // Act
    probe(FIRST_START, FIRST_END, (identifier) => identifiers.push(identifier))

    // Assert
    expect(identifiers).toEqual([])
  })
})

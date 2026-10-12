import { BspTreeNodeKind } from '../../../bsp-tree/index.ts'
import type { BspTree } from '../../../bsp-tree/index.ts'
import type { DecalWorld } from '../../../decal/index.ts'
import {
  addSkidTrailPoint,
  allocateSkidTrail,
  createSkidTrailPool,
  getSkidTrailKind,
  getSkidTrailMeshes,
  releaseSkidTrail,
  stepSkidTrailPool,
} from './skid-trails.ts'

const tree: BspTree = {
  nodes: [
    {
      kind: BspTreeNodeKind.LEAF,
      parentIndex: -1,
      childIndices: [-1, -1],
      keyword28Floats: [0, 0, 0, 0],
      keyword29Values: [0, 0, 0, 0, 0],
    },
  ],
  rootIndex: 0,
  keyword2aEntries: [],
  keyword2bValues: [],
  readByteCount: 0,
}

// A floor of two triangles under the wheels' path.
const world: DecalWorld = {
  tree,
  positions: Float32Array.from([-50, -50, 0, 50, -50, 0, 50, 50, 0, -50, 50, 0]),
  batches: [
    {
      firstCommand: 0,
      isReceiver: true,
      faces: [
        [0, 1, 2],
        [0, 2, 3],
      ],
    },
  ],
}

const request = { racerIndex: 0, width: 2, baseAlpha: 0.5 }

const getStartedPool = () => {
  const made = allocateSkidTrail(createSkidTrailPool(), 1000, request)
  return { pool: made.pool, index: made.index ?? -1 }
}

describe('the skid trails', () => {
  it('takes the first free trail and gives none when the four are in use', () => {
    // Arrange
    const filled = [1, 2, 3, 4].reduce(
      (pool) => allocateSkidTrail(pool, 1000, request).pool,
      createSkidTrailPool()
    )

    // Act
    const fifth = allocateSkidTrail(filled, 1000, request)

    // Assert
    expect(fifth.index).toBeNull()
    expect(filled.trails[3]?.isActive).toBe(true)
    expect(filled.trails[0]?.segmentMilliseconds).toBe(250)
  })

  it('makes the short kind of a spinning car with a duration of whole quarters', () => {
    // Arrange
    const kind = getSkidTrailKind(true)

    // Act
    const trail = allocateSkidTrail(createSkidTrailPool(), kind, request).pool.trails[0]

    // Assert
    expect(kind).toBe(250)
    expect(trail?.durationMilliseconds).toBe(248)
    expect(trail?.segmentMilliseconds).toBe(62)
  })

  it('projects the stretch a wheel moved over onto the floor', () => {
    // Arrange
    const { pool, index } = getStartedPool()
    const first = addSkidTrailPoint(pool, index, { x: 0, y: 0, z: 0 }, 33)

    // Act
    const moved = addSkidTrailPoint(first, index, { x: 0, y: 4, z: 0 }, 33)
    const stepped = stepSkidTrailPool(moved, world, 33)

    // Assert
    expect(getSkidTrailMeshes(first)[0]?.triangles).toEqual([])
    const [mesh] = getSkidTrailMeshes(stepped)
    expect(mesh?.triangles.length).toBeGreaterThan(0)
    expect(mesh?.alpha).toBe(255)
  })

  it('does not change the stretch for a move under 0.1', () => {
    // Arrange
    const { pool, index } = getStartedPool()
    const first = addSkidTrailPoint(pool, index, { x: 0, y: 0, z: 0 }, 33)

    // Act
    const moved = addSkidTrailPoint(first, index, { x: 0, y: 0.05, z: 0 }, 33)

    // Assert
    expect(moved.trails[index]?.isDirty).toBe(false)
    expect(moved.trails[index]?.elapsedMilliseconds).toBe(33)
  })

  it('finishes a stretch into the ring once it has lasted longer than a quarter and starts the next at the wheel', () => {
    // Arrange
    const { pool, index } = getStartedPool()
    const first = addSkidTrailPoint(pool, index, { x: 0, y: 0, z: 0 }, 33)
    const moved = addSkidTrailPoint(first, index, { x: 0, y: 4, z: 0 }, 300)

    // Act
    const stepped = stepSkidTrailPool(moved, world, 33)

    // Assert
    const trail = stepped.trails[index]
    expect(trail?.ringIndex).toBe(1)
    expect(trail?.elapsedMilliseconds).toBe(0)
    expect(trail?.previousPoint).toEqual({ x: 0, y: 4, z: 0 })
    expect(trail?.isShowingLive).toBe(false)
    expect(getSkidTrailMeshes(stepped)[0]?.triangles.length).toBeGreaterThan(0)
  })

  it('fades a released trail over its duration and frees it', () => {
    // Arrange
    const { pool, index } = getStartedPool()
    const released = releaseSkidTrail(pool, index, 1000)

    // Act
    const halfway = stepSkidTrailPool(released, world, 500)
    const over = stepSkidTrailPool(halfway, world, 500)

    // Assert
    expect(halfway.trails[index]?.alpha).toBe(Math.trunc(0.5 * 255 * 0.5))
    expect(over.trails[index]?.isActive).toBe(false)
  })
})

import { BspTreeNodeKind } from '../../../bsp-tree/index.ts'
import type { BspTree } from '../../../bsp-tree/index.ts'
import { createDecalFrame } from '../create-decal-frame/create-decal-frame.ts'
import type { DecalWorld } from '../../types/decal.types.ts'
import { projectDecal } from './project-decal.ts'

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

// A floor triangle around the origin.
const positions = Float32Array.from([-2, -2, 0, 2, -2, 0, 0, 2, 0])

const createWorld = (isReceiver: boolean): DecalWorld => ({
  tree,
  positions,
  batches: [{ firstCommand: 0, isReceiver, faces: [[0, 1, 2]] }],
})

const frame = createDecalFrame({
  position: { x: 0, y: 0, z: 6 },
  normal: { x: 0, y: 0, z: -1 },
  upHint: { x: 0, y: 1, z: 0 },
  width: 10,
  height: 10,
  depth: 15,
})

describe('projectDecal', () => {
  it('maps a receiving triangle inside the box onto the picture around its middle', () => {
    // Arrange
    const world = createWorld(true)

    // Act
    const triangles = projectDecal(world, frame)

    // Assert
    expect(triangles).toHaveLength(1)
    for (const vertex of triangles[0] ?? []) {
      expect(vertex.u).toBeGreaterThan(0.2)
      expect(vertex.u).toBeLessThan(0.8)
      expect(vertex.v).toBeGreaterThan(0.2)
      expect(vertex.v).toBeLessThan(0.8)
    }
  })

  it('ignores materials without the decal flag', () => {
    // Arrange
    const world = createWorld(false)

    // Act
    const triangles = projectDecal(world, frame)

    // Assert
    expect(triangles).toEqual([])
  })

  it('stops at the triangle limit', () => {
    // Arrange
    const world = createWorld(true)

    // Act
    const triangles = projectDecal(world, frame, { maximumTriangles: 0 })

    // Assert
    expect(triangles).toEqual([])
  })

  it('clips a triangle that reaches past the picture edge', () => {
    // Arrange
    const wide = Float32Array.from([-20, -2, 0, 20, -2, 0, 0, 2, 0])
    const world: DecalWorld = { ...createWorld(true), positions: wide }

    // Act
    const triangles = projectDecal(world, frame)

    // Assert
    expect(triangles.length).toBeGreaterThan(0)
    for (const triangle of triangles) {
      for (const vertex of triangle) {
        expect(vertex.u).toBeGreaterThanOrEqual(0)
        expect(vertex.u).toBeLessThanOrEqual(1)
      }
    }
  })
})

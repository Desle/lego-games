import { BspTreeNodeKind } from '@lego-games/lego-racers/bsp-tree'
import type { BspPlane, BspTree } from '@lego-games/lego-racers/bsp-tree'
import { BufferGeometry, Matrix4, Mesh } from 'three'
import { batchFirstCommands, getLocalVisibilityQuery, showVisibleLeaves } from './bsp-visibility.ts'

const NO_PLANE: BspPlane = [0, 0, 0, 0]

const createTree = (): BspTree => ({
  nodes: [
    {
      kind: BspTreeNodeKind.LEAF,
      parentIndex: -1,
      childIndices: [-1, -1],
      keyword28Floats: NO_PLANE,
      keyword29Values: [0, 10, -1, -1, 0],
    },
  ],
  rootIndex: 0,
  keyword2aEntries: [],
  keyword2bValues: [],
  readByteCount: 0,
})

const createMesh = (firstCommand: number): Mesh => {
  const mesh = new Mesh(new BufferGeometry())
  batchFirstCommands.set(mesh, firstCommand)
  return mesh
}

describe('getLocalVisibilityQuery', () => {
  it('mirrors the eye and the planes with the matrix of a mirrored track', () => {
    // Arrange
    const mirror = new Matrix4().makeScale(1, -1, 1)

    // Act
    const query = getLocalVisibilityQuery(
      { eye: { x: 1, y: 2, z: 3 }, planes: [[0, 1, 0, -2]] },
      mirror
    )

    // Assert
    expect(query.eye).toEqual([1, -2, 3])
    expect(query.planes).toEqual([[0, -1, 0, -2]])
  })
})

describe('showVisibleLeaves', () => {
  it('shows the batches whose first command lies in a visible leaf and hides the others', () => {
    // Arrange
    const inside = createMesh(4)
    const outside = createMesh(10)

    // Act
    showVisibleLeaves(createTree(), [{ meshes: [inside, outside] }], {
      eye: [0, 0, 0],
      planes: [],
    })

    // Assert
    expect([inside.visible, outside.visible]).toEqual([true, false])
  })
})

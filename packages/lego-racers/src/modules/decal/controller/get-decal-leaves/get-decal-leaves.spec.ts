import { BspTreeNodeKind } from '../../../bsp-tree/index.ts'
import type { BspTree, BspTreeNode } from '../../../bsp-tree/index.ts'
import { getDecalLeaves } from './get-decal-leaves.ts'

const ZEROES = [0, 0, 0, 0, 0] as const

const branch: BspTreeNode = {
  kind: BspTreeNodeKind.BRANCH,
  parentIndex: -1,
  childIndices: [1, 2],
  keyword28Floats: [1, 0, 0, 0],
  keyword29Values: ZEROES,
}

const createLeaf = (): BspTreeNode => ({
  kind: BspTreeNodeKind.LEAF,
  parentIndex: 0,
  childIndices: [-1, -1],
  keyword28Floats: [0, 0, 0, 0],
  keyword29Values: ZEROES,
})

const tree: BspTree = {
  nodes: [branch, createLeaf(), createLeaf()],
  rootIndex: 0,
  keyword2aEntries: [],
  keyword2bValues: [],
  readByteCount: 0,
}

describe('getDecalLeaves', () => {
  it('names only the leaf of the first point when the other points lie on its side', () => {
    // Arrange
    const points = [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ]

    // Act
    const leaves = getDecalLeaves(tree, points)

    // Assert
    expect(leaves).toEqual([1])
  })

  it('adds the far side of a plane when another point lies beyond it', () => {
    // Arrange
    const points = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
    ]

    // Act
    const leaves = getDecalLeaves(tree, points)

    // Assert
    expect(leaves).toEqual([1, 2])
  })

  it('finds the back leaf first when the first point is behind the plane', () => {
    // Arrange
    const points = [
      { x: -1, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ]

    // Act
    const leaves = getDecalLeaves(tree, points)

    // Assert
    expect(leaves).toEqual([2, 1])
  })
})

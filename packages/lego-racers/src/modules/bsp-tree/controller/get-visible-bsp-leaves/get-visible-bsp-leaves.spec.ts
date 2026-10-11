import { BspTreeNodeKind } from '../../types/bsp-tree-node-kind/bsp-tree-node-kind.ts'
import type {
  BspPlane,
  BspTree,
  BspTreeNode,
  BspTreeSixFloats,
} from '../../types/bsp-tree.types.ts'
import { getEyeLeafIndex, getVisibleBspLeaves } from './get-visible-bsp-leaves.ts'

const ZEROES = [0, 0, 0, 0, 0] as const

const createBranch = (
  childIndices: readonly [number, number],
  plane: BspPlane,
  parentIndex = -1
): BspTreeNode => ({
  kind: BspTreeNodeKind.BRANCH,
  parentIndex,
  childIndices,
  keyword28Floats: plane,
  keyword29Values: ZEROES,
})

// Values in file order: first command, command count, volume index, visibility list offset and count.
const createLeaf = (values: BspTreeNode['keyword29Values']): BspTreeNode => ({
  kind: BspTreeNodeKind.LEAF,
  parentIndex: 0,
  childIndices: [-1, -1],
  keyword28Floats: [0, 0, 0, 0],
  keyword29Values: values,
})

const createTree = (
  nodes: readonly BspTreeNode[],
  volumes: readonly BspTreeSixFloats[],
  visibility: readonly number[]
): BspTree => ({
  nodes,
  rootIndex: 0,
  keyword2aEntries: volumes,
  keyword2bValues: visibility,
  readByteCount: 0,
})

// Looking along +x from the origin: left, right, bottom, top, near and far planes around a 10-unit box.
const FRUSTUM_PLANES: readonly BspPlane[] = [
  [0, 1, 0, 10],
  [0, -1, 0, 10],
  [0, 0, 1, 10],
  [0, 0, -1, 10],
  [1, 0, 0, -5],
  [-1, 0, 0, 100],
]

describe('getVisibleBspLeaves', () => {
  it('draws the leaf holding the eye first, then the listed leaves the frustum does not reject', () => {
    // Arrange
    const tree = createTree(
      [
        createBranch([1, 2], [1, 0, 0, 0]),
        createLeaf([0, 10, 0, -1, 0]),
        createLeaf([10, 5, -1, 0, 2]),
        createLeaf([15, 7, 1, -1, 0]),
      ],
      [
        [20, -2, -2, 30, 2, 2],
        [-300, 0, 0, -200, 1, 1],
      ],
      [1, 3]
    )

    // Act
    const leaves = getVisibleBspLeaves(tree, { eye: [-1, 0, 0], planes: FRUSTUM_PLANES })

    // Assert
    expect(leaves.map(({ nodeIndex, isClipped }) => [nodeIndex, isClipped])).toEqual([
      [2, true],
      [1, false],
    ])
  })

  it('draws a listed leaf without a bounding volume, clipped', () => {
    // Arrange
    const tree = createTree(
      [
        createBranch([1, 2], [1, 0, 0, 0]),
        createLeaf([0, 3, 0, 0, 1]),
        createLeaf([3, 4, -1, 0, 0]),
      ],
      [[-5, -5, -5, 5, 5, 5]],
      [2]
    )

    // Act
    const leaves = getVisibleBspLeaves(tree, { eye: [1, 0, 0], planes: FRUSTUM_PLANES })

    // Assert
    expect(
      leaves.map(({ nodeIndex, firstCommand, commandCount, isClipped }) => [
        nodeIndex,
        firstCommand,
        commandCount,
        isClipped,
      ])
    ).toEqual([
      [1, 0, 3, true],
      [2, 3, 4, true],
    ])
  })

  it('draws only the leaf holding the eye when its visibility list is empty', () => {
    // Arrange
    const tree = createTree(
      [
        createBranch([1, 2], [1, 0, 0, 0]),
        createLeaf([0, 3, 0, -1, 0]),
        createLeaf([3, 4, 0, 0, 0]),
      ],
      [[-5, -5, -5, 5, 5, 5]],
      []
    )

    // Act
    const leaves = getVisibleBspLeaves(tree, { eye: [1, 0, 0], planes: FRUSTUM_PLANES })

    // Assert
    expect(leaves.map(({ nodeIndex }) => nodeIndex)).toEqual([1])
  })
})

describe('getEyeLeafIndex', () => {
  it('goes to the first child on the non-negative side and the second on the negative side', () => {
    // Arrange
    const tree = createTree(
      [createBranch([1, 2], [1, 0, 0, 0]), createLeaf(ZEROES), createLeaf(ZEROES)],
      [],
      []
    )

    // Act
    const front = getEyeLeafIndex(tree, [0, 3, 3])
    const back = getEyeLeafIndex(tree, [-0.5, 0, 0])

    // Assert
    expect([front, back]).toEqual([1, 2])
  })

  it('takes the only child that exists', () => {
    // Arrange
    const tree = createTree([createBranch([-1, 1], [1, 0, 0, 0]), createLeaf(ZEROES)], [], [])

    // Act
    const index = getEyeLeafIndex(tree, [5, 0, 0])

    // Assert
    expect(index).toBe(1)
  })
})

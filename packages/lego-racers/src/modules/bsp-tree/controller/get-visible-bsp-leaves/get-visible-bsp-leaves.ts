import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { BspTreeNodeKind } from '../../types/bsp-tree-node-kind/bsp-tree-node-kind.ts'
import { NO_NODE_INDEX } from '../../types/bsp-tree-keyword/bsp-tree-keyword.ts'
import type {
  BspBoundingVolume,
  BspPlane,
  BspTree,
  BspTreeNode,
  BspVisibilityQuery,
  BspVolumeVisibility,
  VisibleBspLeaf,
} from '../../types/bsp-tree.types.ts'

const raceArithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// GolDP.dll 0x1002bc90: a volume is outside when all eight corners lie behind one plane, partly outside when
// any corner lies behind any plane, else inside. The partial sums that the engine stores in locals are rounded
// to float32 (the first column of the products and the z terms); the rest stay in x87 registers.
export const getVolumeVisibility = (
  arithmetic: FloatArithmetic,
  planes: readonly BspPlane[],
  volume: BspBoundingVolume
): BspVolumeVisibility => {
  const { add, multiply, storeFloat, getIsBelow } = arithmetic
  const [minimumX, minimumY, minimumZ, maximumX, maximumY, maximumZ] = volume
  let isPartlyOutside = false
  for (const [normalX, normalY, normalZ, offset] of planes) {
    const minimumXTerm = storeFloat(multiply(normalX, minimumX))
    const minimumYTerm = multiply(normalY, minimumY)
    const minimumZTerm = storeFloat(add(multiply(normalZ, minimumZ), offset))
    const maximumXTerm = storeFloat(multiply(maximumX, normalX))
    const maximumYTerm = storeFloat(multiply(maximumY, normalY))
    const maximumZTerm = storeFloat(add(multiply(normalZ, maximumZ), offset))
    const minimumYAndZ = add(minimumZTerm, minimumYTerm)
    const maximumYMinimumX = add(maximumYTerm, minimumXTerm)
    const minimumYMaximumZ = add(minimumYTerm, maximumZTerm)
    const maximumYMaximumX = add(maximumYTerm, maximumXTerm)
    const cornerSums = [
      add(minimumYAndZ, minimumXTerm),
      add(minimumYAndZ, maximumXTerm),
      add(maximumYMinimumX, minimumZTerm),
      add(maximumYMinimumX, maximumZTerm),
      add(minimumYMaximumZ, minimumXTerm),
      add(minimumYMaximumZ, maximumXTerm),
      add(maximumYMaximumX, maximumZTerm),
      add(maximumYMaximumX, minimumZTerm),
    ]
    const cornersBehind = cornerSums.filter((sum) => getIsBelow(sum, 0)).length
    if (cornersBehind === cornerSums.length) return 'outside'
    if (cornersBehind > 0) isPartlyOutside = true
  }
  return isPartlyOutside ? 'partly_inside' : 'inside'
}

// GolDP.dll 0x1001b2c0, first loop: from the root, a camera on the plane's non-negative side goes to the first
// child (the second when the first is missing), the other side to the second child (the first when it is missing).
export const getEyeLeafIndex = (
  tree: BspTree,
  eye: readonly [number, number, number]
): number | null => {
  const { add, multiply, getIsBelow } = raceArithmetic
  let index = tree.rootIndex
  let node: BspTreeNode | undefined = index === null ? undefined : tree.nodes[index]
  while (node !== undefined && index !== null && node.kind === BspTreeNodeKind.BRANCH) {
    const [normalX, normalY, normalZ, offset] = node.keyword28Floats
    const [firstChild, secondChild] = node.childIndices
    const distance = add(
      add(add(multiply(normalZ, eye[2]), multiply(normalY, eye[1])), multiply(normalX, eye[0])),
      offset
    )
    const isBackSide = getIsBelow(distance, 0) && secondChild !== NO_NODE_INDEX
    index = isBackSide ? secondChild : firstChild === NO_NODE_INDEX ? secondChild : firstChild
    node = tree.nodes[index]
  }
  return node === undefined || index === null ? null : index
}

const getLeaf = (tree: BspTree, nodeIndex: number, isClipped: boolean): VisibleBspLeaf | null => {
  const node = tree.nodes[nodeIndex]
  if (node === undefined || node.kind !== BspTreeNodeKind.LEAF) return null
  const [firstCommand, commandCount] = node.keyword29Values
  return Object.freeze({ nodeIndex, firstCommand, commandCount, isClipped })
}

// GolDP.dll 0x1001b2c0 and 0x1001b640: the leaf holding the camera is drawn (clipped), then every leaf its
// visibility list names (keyword 0x2b, from the leaf's offset and count) whose bounding volume (keyword 0x2a)
// the frustum does not reject; a leaf without a volume is always drawn. A leaf fully inside needs no clipping.
export const getVisibleBspLeaves = (
  tree: BspTree,
  query: BspVisibilityQuery
): readonly VisibleBspLeaf[] => {
  const eyeLeafIndex = getEyeLeafIndex(tree, query.eye)
  const eyeNode = eyeLeafIndex === null ? undefined : tree.nodes[eyeLeafIndex]
  const eyeLeaf = eyeLeafIndex === null ? null : getLeaf(tree, eyeLeafIndex, true)
  if (eyeNode === undefined || eyeLeaf === null) return Object.freeze([])
  const [, , , listOffset, listCount] = eyeNode.keyword29Values
  const visible: VisibleBspLeaf[] = [eyeLeaf]
  if (listOffset < 0 || listCount === 0) return Object.freeze(visible)
  for (const listed of tree.keyword2bValues.slice(listOffset, listOffset + listCount)) {
    const nodeIndex = listed & 0xffff
    const volumeIndex = tree.nodes[nodeIndex]?.keyword29Values[2] ?? NO_NODE_INDEX
    const volume = volumeIndex < 0 ? undefined : tree.keyword2aEntries[volumeIndex]
    const visibility =
      volume === undefined
        ? 'partly_inside'
        : getVolumeVisibility(raceArithmetic, query.planes, volume)
    const leaf =
      visibility === 'outside' ? null : getLeaf(tree, nodeIndex, visibility === 'partly_inside')
    if (leaf !== null) visible.push(leaf)
  }
  return Object.freeze(visible)
}

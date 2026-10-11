import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { BspTreeNodeKind as BspTreeNodeKindEnum } from './bsp-tree-node-kind/bsp-tree-node-kind.ts'

export type BspTreeNodeKind = EnumValues<typeof BspTreeNodeKindEnum>

// One 32-byte node of 0x1001b010 (offsets in that node); every index is int16, -1 for none.
export type BspTreeNode = {
  // +0: 0 for keyword 0x28, 1 for keyword 0x29.
  readonly kind: BspTreeNodeKind
  // +2: a negative value makes the node the root (0x1001b0b0).
  readonly parentIndex: number
  // Keyword 0x28 only: +0x1c, +0x1e (both -1 fails with error 17); -1 elsewhere.
  readonly childIndices: readonly [number, number]
  // Keyword 0x28 only: four floats at +4..+0x10; zeroes elsewhere.
  readonly keyword28Floats: readonly [number, number, number, number]
  // Keyword 0x29 only, in file order: int +4, int +8, int16 +0x1c, int16 +0x18, int16 +0x1a; zeroes elsewhere.
  readonly keyword29Values: readonly [number, number, number, number, number]
}

export type BspTreeSixFloats = readonly [number, number, number, number, number, number]

export type BspTreeNodesSection = {
  readonly nodes: readonly BspTreeNode[]
  readonly rootIndex: number
}

export type BspTree = {
  readonly nodes: readonly BspTreeNode[]
  // +0xc: the last node with a negative parent, else node 0; null without nodes.
  readonly rootIndex: number | null
  // Keyword 0x2a (0x1001b1a0): six floats per entry, at +0x18.
  readonly keyword2aEntries: readonly BspTreeSixFloats[]
  // Keyword 0x2b: int16 values at +0x20.
  readonly keyword2bValues: readonly number[]
  readonly readByteCount: number
}

// A plane as four floats: the normal and the offset; a point is inside when normal . point + offset is not negative.
export type BspPlane = readonly [number, number, number, number]

// A leaf's bounding volume (keyword 0x2a): the smallest corner, then the largest.
export type BspBoundingVolume = BspTreeSixFloats

export type BspVolumeVisibility = 'outside' | 'partly_inside' | 'inside'

// The camera as the BSP draw sees it (GolDP.dll 0x100092a0): its position and the six planes of its frustum.
export type BspVisibilityQuery = {
  readonly eye: readonly [number, number, number]
  readonly planes: readonly BspPlane[]
}

// A leaf to draw: the run of the mesh's draw commands it covers, and whether the frustum cuts it (the engine then
// draws it through the clipping path).
export type VisibleBspLeaf = {
  readonly nodeIndex: number
  readonly firstCommand: number
  readonly commandCount: number
  readonly isClipped: boolean
}

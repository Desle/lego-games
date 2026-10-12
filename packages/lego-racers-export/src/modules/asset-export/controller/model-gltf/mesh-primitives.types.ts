import type { BoneMatrices } from '@lego-games/lego-racers/skeletal-animation'

export type MeshBake = {
  // The scene material index of each of the mesh's (or its material assignment's) material slots.
  readonly materialIndices: readonly number[]
  // Row-vector bone matrices the vertices are posed with; null leaves them as they are.
  readonly matrices: BoneMatrices | null
  readonly isSkinned: boolean
}

export type CornerSet = {
  // The mesh vertex of each entry.
  readonly vertices: Uint32Array
  // The bone of each entry.
  readonly transforms: Uint8Array
  // The entry of each corner.
  readonly corners: Uint32Array
}

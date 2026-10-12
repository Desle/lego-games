import type { BoneMatrices } from '@lego-games/lego-racers/skeletal-animation'

export type SkeletonNodes = {
  // The bones without a parent.
  readonly rootNodes: readonly number[]
  readonly skinIndex: number
  // The row-vector world matrix of each bone at rest.
  readonly restMatrices: BoneMatrices
}

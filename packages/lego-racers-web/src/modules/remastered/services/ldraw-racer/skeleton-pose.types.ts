import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { Matrix4 } from 'three'

export type SkeletonPoseSampler = {
  readonly boneNames: readonly string[]
  readonly parentIndices: readonly (number | null)[]
  // The rest pose's matrices, which take a bone-local point to the model's frame.
  readonly restMatrices: readonly Matrix4[]
  readonly getMatrices: (state: SkeletonAnimationState) => readonly Matrix4[]
  // The state the original starts the model in (the given clip at time 0), null when the clip does not exist.
  readonly createState: (clipIndex?: number) => SkeletonAnimationState | null
  readonly advance: (
    state: SkeletonAnimationState,
    deltaMilliseconds: number
  ) => SkeletonAnimationState
}

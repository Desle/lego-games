import type { ModelScene } from '@lego-games/lego-racers/scene'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Matrix4 } from 'three'
import type { SkeletonPoseSampler } from './skeleton-pose.types.ts'

const MATRIX_SIZE = 16
const FIRST_CLIP_INDEX = 0

const getMatrices = (matrices: Float32Array, boneCount: number): readonly Matrix4[] =>
  Array.from({ length: boneCount }, (_unused, boneIndex) =>
    new Matrix4().fromArray(matrices, boneIndex * MATRIX_SIZE)
  )

// The bone matrices a skeleton model's pose gives (GolDP.dll 0x10014c20: each bone's matrix times its parent's, row vectors, so the
// array reads as three.js column-major matrices that take a bone-local point to the model's frame), for the state the original
// poses it with, or for the rest pose when there is none. Null when the model has no skeleton.
export const createSkeletonPoseSampler = (model: ModelScene): SkeletonPoseSampler | null => {
  const level = model.scene.instances[0]?.levels[0]
  const skeleton = model.scene.skeletons[level?.skeletonIndex ?? -1]?.skeleton
  const animation = model.scene.animations[level?.animationIndex ?? -1]?.animation
  if (skeleton === undefined || animation === undefined) return null
  const restPose = getRestPose(skeleton)
  const boneCount = skeleton.bones.length
  const startClipIndex = model.scene.instances[0]?.startClipIndex ?? FIRST_CLIP_INDEX
  return Object.freeze({
    boneNames: Object.freeze(skeleton.bones.map((bone) => bone.name)),
    parentIndices: Object.freeze(skeleton.bones.map((bone) => bone.parentIndex)),
    restMatrices: getMatrices(getBoneMatrices(skeleton, restPose), boneCount),
    getMatrices: (state: SkeletonAnimationState) =>
      getMatrices(
        getBoneMatrices(skeleton, getSkeletonPose(restPose, animation, state)),
        boneCount
      ),
    createState: (clipIndex = startClipIndex) =>
      animation.clips[clipIndex] === undefined
        ? null
        : createSkeletonAnimationState(animation, clipIndex),
    advance: (state: SkeletonAnimationState, deltaMilliseconds: number) =>
      advanceSkeletonAnimation(state, animation, deltaMilliseconds),
  })
}

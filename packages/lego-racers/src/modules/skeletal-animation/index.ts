export { getBoneMatrices, getRestPose } from './controller/get-bone-matrices/get-bone-matrices.ts'
export {
  getBoneRotation,
  IDENTITY_BONE_ROTATION,
} from './controller/get-bone-rotation/get-bone-rotation.ts'
export { getInstancePosition } from './controller/get-instance-position/get-instance-position.ts'
export { getSkeletalAnimation } from './controller/get-skeletal-animation/get-skeletal-animation.ts'
export {
  getTransformedNormals,
  getTransformedPositions,
} from './controller/get-transformed-vertices/get-transformed-vertices.ts'
export { getSkeletonPose } from './controller/get-skeleton-pose/get-skeleton-pose.ts'
export {
  getBlendedQuaternion,
  samplePosition,
  sampleRotation,
} from './controller/sample-animation-track/sample-animation-track.ts'
export {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
} from './controller/skeleton-animation-state/skeleton-animation-state.ts'
export { SkeletalAnimationError } from './types/skeletal-animation-errors/skeletal-animation-errors.ts'
export type {
  AnimationClip,
  AnimationTrack,
  BoneMatrices,
  BoneRotation,
  BoneTransform,
  PlayingClip,
  PositionSample,
  RotationSample,
  SkeletalAnimation,
  SkeletalPose,
  SkeletonAnimationState,
  Vector3,
} from './types/skeletal-animation.types.ts'

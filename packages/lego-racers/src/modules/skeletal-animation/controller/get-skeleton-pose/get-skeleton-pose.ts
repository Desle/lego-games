import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type {
  BoneTransform,
  PlayingClip,
  PositionSample,
  RotationSample,
  SampledClip,
  SkeletalAnimation,
  SkeletalPose,
  SkeletonAnimationState,
  Vector3,
} from '../../types/skeletal-animation.types.ts'
import { getBoneRotation } from '../get-bone-rotation/get-bone-rotation.ts'
import { getWrappedTime } from '../get-wrapped-time/get-wrapped-time.ts'
import {
  getBlendedQuaternion,
  samplePosition,
  sampleRotation,
} from '../sample-animation-track/sample-animation-track.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, multiply, storeFloat, subtract } = arithmetic

const getSampledClip = (
  animation: SkeletalAnimation,
  playing: PlayingClip,
  isLooping: boolean
): SampledClip | null => {
  const clip = animation.clips[playing.clipIndex]
  if (clip === undefined) return null
  return Object.freeze({
    clip,
    time: isLooping ? getWrappedTime(clip, playing.timeInFrames) : playing.timeInFrames,
    frameCount: isLooping ? clip.loopLength : clip.frameCount,
  })
}

const getBlendedPosition = (first: Vector3, second: Vector3, factor: number): Vector3 => {
  const getComponent = (axis: 0 | 1 | 2): number =>
    storeFloat(add(multiply(storeFloat(subtract(second[axis], first[axis])), factor), first[axis]))
  return Object.freeze([getComponent(0), getComponent(1), getComponent(2)] as const)
}

// 0x10023580 for one bone: a position or rotation only changes where a clip has keys; where both clips of a
// blend have keys the two samples are blended by the blend factor (+0xec), where one has the bone takes that.
const getBoneTransform = (
  restTransform: BoneTransform,
  positions: readonly [PositionSample, PositionSample],
  rotations: readonly [RotationSample, RotationSample],
  factor: number
): BoneTransform => {
  const [firstPosition, secondPosition] = positions
  const [firstRotation, secondRotation] = rotations
  const position =
    firstPosition !== null && secondPosition !== null
      ? getBlendedPosition(firstPosition, secondPosition, factor)
      : (firstPosition ?? secondPosition)
  const rotation =
    firstRotation !== null && secondRotation !== null
      ? getBlendedQuaternion(firstRotation, secondRotation, factor)
      : (firstRotation ?? secondRotation)
  return Object.freeze({
    rotation: rotation === null ? restTransform.rotation : getBoneRotation(rotation),
    translation: position ?? restTransform.translation,
  })
}

// GolDP.dll 0x10023580 (skeleton instance vtable +0x5c): sets every bone from the instance's clip, and from the
// second clip while it blends. `rest` holds the pose the bones have before sampling (the skeleton file's, or
// the last one sampled); a bone whose track has no keys keeps it. A clip index past the animation's clips
// leaves the pose alone.
export const getSkeletonPose = (
  rest: SkeletalPose,
  animation: SkeletalAnimation,
  state: SkeletonAnimationState
): SkeletalPose => {
  const first = getSampledClip(animation, state.clip, state.isLooping)
  if (first === null) return rest
  const second = state.isBlending
    ? getSampledClip(animation, state.secondClip, state.isSecondLooping)
    : null
  const factor = state.blendFactor
  return Object.freeze({
    bones: Object.freeze(
      rest.bones.map((restTransform, boneIndex) => {
        const firstTrack = animation.tracks[first.clip.firstTrackIndex + boneIndex]
        const secondTrack =
          second === null ? undefined : animation.tracks[second.clip.firstTrackIndex + boneIndex]
        const firstPosition =
          firstTrack === undefined
            ? null
            : samplePosition(animation, firstTrack, first.time, first.frameCount)
        const firstRotation =
          firstTrack === undefined
            ? null
            : sampleRotation(animation, firstTrack, first.time, first.frameCount)
        const secondPosition =
          second === null || secondTrack === undefined
            ? null
            : samplePosition(animation, secondTrack, second.time, second.frameCount)
        const secondRotation =
          second === null || secondTrack === undefined
            ? null
            : sampleRotation(animation, secondTrack, second.time, second.frameCount)
        return getBoneTransform(
          restTransform,
          [firstPosition, secondPosition],
          [firstRotation, secondRotation],
          factor
        )
      })
    ),
  })
}

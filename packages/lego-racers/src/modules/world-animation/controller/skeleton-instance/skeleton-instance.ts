import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
  getBonePosition,
  getRestPose,
  getSkeletonPose,
} from '../../../skeletal-animation/index.ts'
import type { SkeletonAnimationState, Vector3 } from '../../../skeletal-animation/index.ts'
import {
  createFloatArithmetic,
  getFrameTransformedPoint,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { SkeletonInstanceRuntime } from '../../types/world-animation.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, multiply, storeFloat } = arithmetic

// The bits of instance +0x5c that the port models as the animation state (GolDP.dll 0x10023b10).
export const INSTANCE_ANIMATED_FLAG = 0x10000
export const INSTANCE_BLENDING_FLAG = 0x20000
export const INSTANCE_LOOPING_FLAG = 0x40000
export const INSTANCE_FINISHED_FLAG = 0x80000
export const INSTANCE_CONTINUING_FLAG = 0x100000
export const INSTANCE_SECOND_LOOPING_FLAG = 0x400000
export const INSTANCE_WRAPPED_FLAG = 0x2000000
const MODELLED_FLAGS =
  INSTANCE_ANIMATED_FLAG |
  INSTANCE_BLENDING_FLAG |
  INSTANCE_LOOPING_FLAG |
  INSTANCE_FINISHED_FLAG |
  INSTANCE_CONTINUING_FLAG |
  INSTANCE_SECOND_LOOPING_FLAG |
  INSTANCE_WRAPPED_FLAG
const ZERO_VELOCITY: Vector3 = Object.freeze([0, 0, 0] as const)

const getFlagBit = (isSet: boolean, flag: number): number => (isSet ? flag : 0)

// Instance +0x5c as the word the original keeps.
export const getSkeletonInstanceFlags = (instance: SkeletonInstanceRuntime): number => {
  const { clip } = instance
  return (
    (instance.otherFlags |
      getFlagBit(instance.isAnimated, INSTANCE_ANIMATED_FLAG) |
      getFlagBit(clip?.isBlending === true, INSTANCE_BLENDING_FLAG) |
      getFlagBit(clip?.isLooping === true, INSTANCE_LOOPING_FLAG) |
      getFlagBit(clip?.isFinished === true, INSTANCE_FINISHED_FLAG) |
      getFlagBit(clip?.isContinuingWithSecondClip === true, INSTANCE_CONTINUING_FLAG) |
      getFlagBit(clip?.isSecondLooping === true, INSTANCE_SECOND_LOOPING_FLAG) |
      getFlagBit(clip?.isWrapped === true, INSTANCE_WRAPPED_FLAG)) >>>
    0
  )
}

// Writes a flag word back: the modelled bits become the animation state's booleans, the rest is kept. An instance
// without a clip keeps the bits it cannot hold in its other flags.
export const getSkeletonInstanceWithFlags = (
  instance: SkeletonInstanceRuntime,
  flags: number
): SkeletonInstanceRuntime => {
  const { clip } = instance
  const has = (flag: number): boolean => (flags & flag) !== 0
  return Object.freeze({
    ...instance,
    isAnimated: has(INSTANCE_ANIMATED_FLAG),
    otherFlags: (clip === null ? flags : flags & ~MODELLED_FLAGS) >>> 0,
    clip:
      clip === null
        ? null
        : Object.freeze({
            ...clip,
            isBlending: has(INSTANCE_BLENDING_FLAG),
            isLooping: has(INSTANCE_LOOPING_FLAG),
            isFinished: has(INSTANCE_FINISHED_FLAG),
            isContinuingWithSecondClip: has(INSTANCE_CONTINUING_FLAG),
            isSecondLooping: has(INSTANCE_SECOND_LOOPING_FLAG),
            isWrapped: has(INSTANCE_WRAPPED_FLAG),
          }),
  })
}

// The instance's flag word with the bits of `setMask` set and then those of `clearMask` cleared.
export const getSkeletonInstanceWithFlagsChanged = (
  instance: SkeletonInstanceRuntime,
  setMask: number,
  clearMask: number
): SkeletonInstanceRuntime =>
  getSkeletonInstanceWithFlags(
    instance,
    (getSkeletonInstanceFlags(instance) | setMask) & ~clearMask
  )

// The animation time the hazards read: +0xb4, or +0xd0 while the instance blends (flag 0x20000).
export const getSkeletonInstanceTime = (instance: SkeletonInstanceRuntime): number => {
  const { clip } = instance
  if (clip === null) return 0
  return clip.isBlending ? clip.secondClip.timeInFrames : clip.clip.timeInFrames
}

// LEGORacers.exe 0x0040e360: the clip has finished when its flag is set, or when it does not loop and its time is at
// the last frame.
export const getIsSkeletonInstanceFinished = (instance: SkeletonInstanceRuntime): boolean => {
  const { animation, clip } = instance
  if (clip === null || animation === null) return false
  if (clip.isFinished) return true
  const frameCount = animation.clips[clip.clip.clipIndex]?.frameCount ?? 0
  return !clip.isLooping && frameCount - 1 <= clip.clip.timeInFrames
}

// Instance +0xb4: the first clip's time, written directly (the Royal Knights hammer's loader does).
export const getSkeletonInstanceWithTime = (
  instance: SkeletonInstanceRuntime,
  timeInFrames: number
): SkeletonInstanceRuntime =>
  instance.clip === null
    ? instance
    : Object.freeze({
        ...instance,
        clip: Object.freeze({
          ...instance.clip,
          clip: Object.freeze({ ...instance.clip.clip, timeInFrames }),
        }),
      })

// The instance's +0xbc: the clip it plays.
export const getSkeletonInstanceClipIndex = (instance: SkeletonInstanceRuntime): number =>
  instance.clip?.clip.clipIndex ?? 0

// LEGORacers.exe 0x0040dae0 (0x0040dad0 passes 0): the clip starts looping at `timeScale` milliseconds worth of
// frames (0 from the start), at its own rate; what 0x0040dae0 leaves alone (the animated flag, the wrapped flag,
// the second clip) stays. An instance without an animation cannot start a clip.
export const startSkeletonInstanceClip = (
  instance: SkeletonInstanceRuntime,
  clipIndex: number,
  timeScale: number
): SkeletonInstanceRuntime => {
  const { animation } = instance
  const clip = animation?.clips[clipIndex]
  if (animation === null || clip === undefined) return instance
  const base = instance.clip ?? createSkeletonAnimationState(animation, clipIndex)
  const timeInFrames =
    timeScale === 0 ? 0 : storeFloat(multiply(timeScale, clip.framesPerMillisecond))
  const started: SkeletonAnimationState = Object.freeze({
    ...base,
    clip: Object.freeze({
      clipIndex,
      timeInFrames,
      framesPerMillisecond: clip.framesPerMillisecond,
      velocity: clip.velocity,
    }),
    velocity: clip.velocity,
    isLooping: true,
    isFinished: false,
    isBlending: false,
    isContinuingWithSecondClip: false,
    isSecondLooping: false,
  })
  return Object.freeze({ ...instance, clip: started })
}

// GolDP.dll 0x10027f40: position plus the elapsed milliseconds times the velocity; x and y add stored products,
// z adds the product still on the FPU stack.
const getMovedPosition = (position: Vector3, velocity: Vector3, milliseconds: number): Vector3 =>
  Object.freeze([
    storeFloat(add(position[0], storeFloat(multiply(milliseconds, velocity[0])))),
    storeFloat(add(position[1], storeFloat(multiply(milliseconds, velocity[1])))),
    storeFloat(add(position[2], multiply(milliseconds, velocity[2]))),
  ] as const)

// GolDP.dll 0x10023b10 (skeleton instance vtable +0x10): an animated instance advances its clip, then the
// instance moves by its velocity. Without the animated flag only the wrapped flag clears and the velocity applies.
export const advanceSkeletonInstance = (
  instance: SkeletonInstanceRuntime,
  milliseconds: number
): SkeletonInstanceRuntime => {
  const { animation, clip } = instance
  const advanced =
    instance.isAnimated && clip !== null && animation !== null
      ? advanceSkeletonAnimation(clip, animation, milliseconds)
      : clip === null
        ? null
        : Object.freeze({ ...clip, isWrapped: false })
  return Object.freeze({
    ...instance,
    clip: advanced,
    position: getMovedPosition(
      instance.position,
      advanced?.velocity ?? ZERO_VELOCITY,
      milliseconds
    ),
  })
}

// 0x0045ebe0 and the frame's transform (slot +0x2c): where a bone's origin is in the world, as the pose of the instance's
// clip puts it.
export const getSkeletonInstanceBonePosition = (
  floatArithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  boneIndex: number
): Vector3 | null => {
  if (instance.skeleton === null || instance.animation === null) return null
  const pose =
    instance.clip === null
      ? getRestPose(instance.skeleton)
      : getSkeletonPose(getRestPose(instance.skeleton), instance.animation, instance.clip)
  const local = getBonePosition(floatArithmetic, instance.skeleton, pose, boneIndex)
  if (local === null) return null
  const scale = (value: number) =>
    floatArithmetic.storeFloat(floatArithmetic.multiply(value, instance.scale))
  const [x, y, z] = instance.position
  const moved = getFrameTransformedPoint(
    floatArithmetic,
    { rotation: instance.rotation, position: { x, y, z } },
    { x: scale(local[0]), y: scale(local[1]), z: scale(local[2]) }
  )
  return Object.freeze([moved.x, moved.y, moved.z] as const)
}

import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { SkeletalAnimationError } from '../../types/skeletal-animation-errors/skeletal-animation-errors.ts'
import type {
  AnimationClip,
  BlendStep,
  PlayingClip,
  SkeletalAnimation,
  SkeletonAnimationState,
  Vector3,
} from '../../types/skeletal-animation.types.ts'
import { getWrappedTime } from '../get-wrapped-time/get-wrapped-time.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, divide, multiply, storeFloat, subtract } = arithmetic

const ONE = 1

const getPlayingClip = (clipIndex: number, clip: AnimationClip): PlayingClip =>
  Object.freeze({
    clipIndex,
    timeInFrames: 0,
    framesPerMillisecond: clip.framesPerMillisecond,
    velocity: clip.velocity,
  })

// The last frame of a clip as a float: `(float)(frameCount - 1)` (0x10023c5e, 0x10023dce).
const getLastFrame = (animation: SkeletalAnimation, clipIndex: number): number =>
  (animation.clips[clipIndex]?.frameCount ?? 0) - 1

// GolDP.dll 0x10023a70 (the world's keyword 0x35 and the instance linking 0x1002e640 call it): the instance
// starts the clip at time 0 looping, at the clip's rate, with the clip's vector as its velocity. The second
// clip has not been set, so it mirrors the first.
export const createSkeletonAnimationState = (
  animation: SkeletalAnimation,
  clipIndex: number
): SkeletonAnimationState => {
  const clip = animation.clips[clipIndex]
  if (clip === undefined) {
    throw new SkeletalAnimationError(`The animation has no clip ${String(clipIndex)}`)
  }
  const playing = getPlayingClip(clipIndex, clip)
  return Object.freeze({
    clip: playing,
    secondClip: playing,
    isLooping: true,
    isFinished: false,
    isWrapped: false,
    isContinuingWithSecondClip: false,
    isSecondLooping: false,
    isBlending: false,
    isFirstAdvancing: false,
    isSecondAdvancing: false,
    blendFactor: 0,
    blendFactorPerMillisecond: 0,
    velocity: clip.velocity,
  })
}

// The time of a playing clip after `delta` milliseconds (0x10023c2c..0x10023c97 and 0x10023cab..0x10023d16):
// past the last frame it wraps if the clip loops, else stops on the last frame.
const getAdvancedBlendClip = (
  animation: SkeletalAnimation,
  playing: PlayingClip,
  isLooping: boolean,
  deltaAsFloat: number
): PlayingClip => {
  const clip = animation.clips[playing.clipIndex]
  const time = storeFloat(
    add(multiply(playing.framesPerMillisecond, deltaAsFloat), playing.timeInFrames)
  )
  const lastFrame = getLastFrame(animation, playing.clipIndex)
  if (clip === undefined || !(time > lastFrame))
    return Object.freeze({ ...playing, timeInFrames: time })
  return Object.freeze({
    ...playing,
    timeInFrames: isLooping ? getWrappedTime(clip, time) : lastFrame,
  })
}

const getBlendedVelocity = (from: Vector3, to: Vector3, factor: number): Vector3 => {
  const getComponent = (axis: 0 | 1 | 2): number =>
    storeFloat(
      add(storeFloat(multiply(factor, storeFloat(subtract(to[axis], from[axis])))), from[axis])
    )
  return Object.freeze([getComponent(0), getComponent(1), getComponent(2)] as const)
}

// 0x10023b47..0x10023d88: while the instance blends, the factor grows by its rate times the elapsed time. Once
// it reaches 1 the second clip becomes the first (at the time it had, with its rate and vector) and the part
// of the step the blend overshot by is left for the first clip to advance; before that both clips may advance
// and the velocity moves from the first clip's to the second's by the factor.
const getBlendStep = (
  state: SkeletonAnimationState,
  animation: SkeletalAnimation,
  deltaMilliseconds: number
): BlendStep => {
  const deltaAsFloat = storeFloat(deltaMilliseconds)
  const factor = storeFloat(
    add(multiply(state.blendFactorPerMillisecond, deltaAsFloat), state.blendFactor)
  )
  if (factor < ONE || Number.isNaN(factor)) {
    const clip = state.isFirstAdvancing
      ? getAdvancedBlendClip(animation, state.clip, state.isLooping, deltaAsFloat)
      : state.clip
    const secondClip = state.isSecondAdvancing
      ? getAdvancedBlendClip(animation, state.secondClip, state.isSecondLooping, deltaAsFloat)
      : state.secondClip
    return Object.freeze({
      state: Object.freeze({
        ...state,
        clip,
        secondClip,
        blendFactor: factor,
        velocity: getBlendedVelocity(clip.velocity, secondClip.velocity, factor),
      }),
      deltaMilliseconds,
    })
  }
  const overshoot = Math.trunc(divide(subtract(factor, ONE), state.blendFactorPerMillisecond))
  return Object.freeze({
    state: Object.freeze({
      ...state,
      clip: state.secondClip,
      velocity: state.secondClip.velocity,
      isLooping: state.isSecondLooping,
      isContinuingWithSecondClip: false,
      isBlending: false,
      blendFactor: factor,
    }),
    deltaMilliseconds: deltaMilliseconds - overshoot,
  })
}

// 0x10023e1f..0x10023ec5: a clip that ends and continues with the second clip's index restarts from that
// clip's beginning, looping.
const getContinuedState = (
  state: SkeletonAnimationState,
  animation: SkeletalAnimation
): SkeletonAnimationState => {
  const clipIndex = state.secondClip.clipIndex
  const clip = animation.clips[clipIndex]
  if (clip === undefined) return Object.freeze({ ...state, isFinished: true })
  return Object.freeze({
    ...state,
    clip: getPlayingClip(clipIndex, clip),
    velocity: clip.velocity,
    isLooping: true,
    isBlending: false,
    isContinuingWithSecondClip: false,
    isSecondLooping: false,
    isFinished: true,
  })
}

// 0x10023d8b..0x10023ec5, the update of an instance that is not blending.
const getSteadyState = (
  state: SkeletonAnimationState,
  animation: SkeletalAnimation,
  deltaMilliseconds: number
): SkeletonAnimationState => {
  const clip = animation.clips[state.clip.clipIndex]
  const time = storeFloat(
    add(multiply(deltaMilliseconds, state.clip.framesPerMillisecond), state.clip.timeInFrames)
  )
  const lastFrame = getLastFrame(animation, state.clip.clipIndex)
  const advanced = Object.freeze({
    ...state,
    clip: Object.freeze({ ...state.clip, timeInFrames: time }),
  })
  if (clip === undefined || time < lastFrame || Number.isNaN(time)) return advanced
  if (state.isLooping) {
    const wrapped = getWrappedTime(clip, time)
    return Object.freeze({
      ...advanced,
      clip: Object.freeze({ ...state.clip, timeInFrames: wrapped }),
      isWrapped: wrapped < time,
    })
  }
  if (state.isContinuingWithSecondClip) return getContinuedState(advanced, animation)
  return Object.freeze({
    ...advanced,
    clip: Object.freeze({ ...state.clip, timeInFrames: lastFrame }),
    isFinished: true,
  })
}

// GolDP.dll 0x10023b10 (skeleton instance vtable +0x10) for an instance with an animation: advances the clips
// by `deltaMilliseconds` (an integer). The position's share of the update is `getInstancePosition`.
export const advanceSkeletonAnimation = (
  state: SkeletonAnimationState,
  animation: SkeletalAnimation,
  deltaMilliseconds: number
): SkeletonAnimationState => {
  const unwrapped = Object.freeze({ ...state, isWrapped: false })
  if (!unwrapped.isBlending) return getSteadyState(unwrapped, animation, deltaMilliseconds)
  const step = getBlendStep(unwrapped, animation, deltaMilliseconds)
  return step.state.isBlending
    ? step.state
    : getSteadyState(step.state, animation, step.deltaMilliseconds)
}

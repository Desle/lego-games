import { SkeletalAnimationError } from '../../types/skeletal-animation-errors/skeletal-animation-errors.ts'
import type {
  PlayingClip,
  SkeletalAnimation,
  SkeletonAnimationState,
  Vector3,
} from '../../types/skeletal-animation.types.ts'
import { createSkeletonAnimationState } from '../skeleton-animation-state/skeleton-animation-state.ts'
import type { SkeletonClipBlend } from './skeleton-clip-control.types.ts'

const ZERO_VELOCITY: Vector3 = Object.freeze([0, 0, 0])

const getClip = (animation: SkeletalAnimation, clipIndex: number) => {
  const clip = animation.clips[clipIndex]
  if (clip === undefined) {
    throw new SkeletalAnimationError(`The animation has no clip ${String(clipIndex)}`)
  }
  return clip
}

// LEGORacers.exe 0x0040dad0 -> 0x0040dae0 (the clip starts at time 0 and clears the blend, finished, continue and
// second-loops flags), followed by the caller clearing the loop flag (0x00481000 does: `flags & ~0x40000`): the clip plays
// once from its start.
export const playSkeletonClipOnce = (
  animation: SkeletalAnimation,
  clipIndex: number
): SkeletonAnimationState =>
  Object.freeze({ ...createSkeletonAnimationState(animation, clipIndex), isLooping: false })

// The clip the figure shows: the new clip while it blends, else the first (0x0040db80 reads +0xd8 or +0xbc).
export const getShownClipIndex = (state: SkeletonAnimationState): number =>
  state.isBlending ? state.secondClip.clipIndex : state.clip.clipIndex

// LEGORacers.exe 0x0040e360: the first clip has finished (flag 0x80000) or does not loop and is on its last frame.
export const getIsSkeletonClipEnded = (
  animation: SkeletalAnimation,
  state: SkeletonAnimationState
): boolean => {
  if (state.isFinished) return true
  const frameCount = animation.clips[state.clip.clipIndex]?.frameCount ?? 0
  return !state.isLooping && frameCount - 1 <= state.clip.timeInFrames
}

// A blend in progress completes first: the new clip becomes the first (0x0040db80's first branch).
const getSettledState = (state: SkeletonAnimationState): SkeletonAnimationState =>
  state.isBlending
    ? Object.freeze({
        ...state,
        clip: state.secondClip,
        velocity: state.secondClip.velocity,
        isLooping: state.isSecondLooping,
        isBlending: false,
        isContinuingWithSecondClip: false,
      })
    : state

// LEGORacers.exe 0x0040db80 with a duration: asking for the clip already shown changes nothing; else the figure blends
// to the clip, which starts at time 0 at its own rate. A first clip that does not advance has no velocity.
export const blendToSkeletonClip = (
  animation: SkeletalAnimation,
  state: SkeletonAnimationState,
  blend: SkeletonClipBlend
): SkeletonAnimationState => {
  if (blend.clipIndex === getShownClipIndex(state)) return state
  const clip = getClip(animation, blend.clipIndex)
  const settled = getSettledState(state)
  const target: PlayingClip = Object.freeze({
    clipIndex: blend.clipIndex,
    timeInFrames: 0,
    framesPerMillisecond: clip.framesPerMillisecond,
    velocity: clip.velocity,
  })
  const first: PlayingClip = blend.isFirstAdvancing
    ? settled.clip
    : Object.freeze({ ...settled.clip, velocity: ZERO_VELOCITY })
  return Object.freeze({
    ...settled,
    clip: first,
    secondClip: target,
    isBlending: true,
    isFinished: false,
    isContinuingWithSecondClip: false,
    isSecondLooping: blend.isTargetLooping,
    isFirstAdvancing: blend.isFirstAdvancing,
    isSecondAdvancing: blend.isSecondAdvancing,
    blendFactor: 0,
    blendFactorPerMillisecond: Math.fround(1 / blend.durationMilliseconds),
  })
}

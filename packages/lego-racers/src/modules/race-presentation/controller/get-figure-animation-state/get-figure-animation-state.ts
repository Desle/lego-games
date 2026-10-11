import type { Figure } from '../../../racer/index.ts'
import type { PlayingClip, SkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'

// Figure flags (+0x5c).
const BLENDS_FLAG = 0x20000
const LOOPS_FLAG = 0x40000
const ENDED_FLAG = 0x80000
const CHAINS_FLAG = 0x100000
const TARGET_LOOPS_FLAG = 0x400000
const WRAPPED_FLAG = 0x2000000

const getTuple = (vector: Vector3): readonly [number, number, number] =>
  Object.freeze([vector.x, vector.y, vector.z] as const)

const getPlayingClip = (
  clipIndex: number,
  timeInFrames: number,
  framesPerMillisecond: number,
  vector: Vector3
): PlayingClip =>
  Object.freeze({ clipIndex, timeInFrames, framesPerMillisecond, velocity: getTuple(vector) })

// A racer's figure (the exe's copy of the skeleton instance of GolDP.dll 0x10023b10, fields +0x5c, +0xb4.., +0xd0..,
// +0xec) as the animation state the pose sampling reads: the current animation is the first clip and the target the
// second, which only counts while the figure blends.
export const getFigureAnimationState = (figure: Figure): SkeletonAnimationState =>
  Object.freeze({
    clip: getPlayingClip(
      figure.currentId,
      figure.currentTime,
      figure.currentRate,
      figure.currentVector
    ),
    secondClip: getPlayingClip(
      figure.targetId,
      figure.targetTime,
      figure.targetRate,
      figure.targetVector
    ),
    isLooping: (figure.flags & LOOPS_FLAG) !== 0,
    isFinished: (figure.flags & ENDED_FLAG) !== 0,
    isWrapped: (figure.flags & WRAPPED_FLAG) !== 0,
    isContinuingWithSecondClip: (figure.flags & CHAINS_FLAG) !== 0,
    isSecondLooping: (figure.flags & TARGET_LOOPS_FLAG) !== 0,
    isBlending: (figure.flags & BLENDS_FLAG) !== 0,
    isFirstAdvancing: figure.isCurrentAdvancing,
    isSecondAdvancing: figure.isTargetAdvancing,
    blendFactor: figure.blend,
    blendFactorPerMillisecond: figure.blendRate,
    velocity: getTuple(figure.outputVector),
  })

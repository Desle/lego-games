import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type {
  AnimationTrack,
  KeyInterval,
  PositionSample,
  RotationSample,
  SkeletalAnimation,
} from '../../types/skeletal-animation.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, divide, multiply, storeFloat, subtract } = arithmetic

// 0x10024380 / 0x10024540: the key times are uint16 and shared; the number of keys at or before the time says
// where it falls. Before the first key and after the last the interval wraps from the last key to the first
// across the end of the clip, `frameCount` frames long.
const getKeyInterval = (
  animation: SkeletalAnimation,
  timeStart: number,
  count: number,
  time: number,
  frameCount: number
): KeyInterval => {
  const getKeyTime = (key: number): number => animation.times[timeStart + key] ?? 0
  let keysReached = 0
  while (keysReached < count && !(time < getKeyTime(keysReached))) keysReached++
  const lastKey = count - 1
  const isInside = keysReached !== 0 && keysReached !== count
  const wrappedSpan = getKeyTime(0) - getKeyTime(lastKey) + frameCount
  const span = isInside ? getKeyTime(keysReached) - getKeyTime(keysReached - 1) : wrappedSpan
  const elapsed =
    keysReached === 0
      ? add(wrappedSpan - getKeyTime(0), time)
      : subtract(time, getKeyTime(keysReached - 1))
  return Object.freeze({
    previousKey: isInside ? keysReached - 1 : lastKey,
    nextKey: isInside ? keysReached : 0,
    fraction: span === 0 ? 0 : divide(elapsed, span),
  })
}

// 0x10024380: previous + (next - previous) · fraction, a key with one entry is returned as it is.
export const samplePosition = (
  animation: SkeletalAnimation,
  track: AnimationTrack,
  time: number,
  frameCount: number
): PositionSample => {
  if (track.positionCount === 0) return null
  const first = animation.positions[track.positionStart]
  if (track.positionCount === 1) return first ?? null
  const interval = getKeyInterval(
    animation,
    track.positionTimeStart,
    track.positionCount,
    time,
    frameCount
  )
  const previous = animation.positions[track.positionStart + interval.previousKey]
  const next = animation.positions[track.positionStart + interval.nextKey]
  if (previous === undefined || next === undefined) return null
  const getComponent = (axis: 0 | 1 | 2): number =>
    storeFloat(
      add(
        multiply(interval.fraction, storeFloat(subtract(next[axis], previous[axis]))),
        previous[axis]
      )
    )
  return Object.freeze([getComponent(0), getComponent(1), getComponent(2)] as const)
}

// 0x1002f890: the interpolation of two quaternions the animation uses. Quaternions on opposite sides of the
// 4D sphere (negative dot product) are blended through the negated second one.
export const getBlendedQuaternion = (
  from: readonly [number, number, number, number],
  to: readonly [number, number, number, number],
  fraction: number
): readonly [number, number, number, number] => {
  const [fromX, fromY, fromZ, fromW] = from
  const [toX, toY, toZ, toW] = to
  const dot = add(
    add(add(multiply(fromY, toY), multiply(fromZ, toZ)), multiply(fromW, toW)),
    multiply(fromX, toX)
  )
  const getComponent = (fromValue: number, toValue: number): number =>
    dot > 0
      ? storeFloat(add(multiply(subtract(toValue, fromValue), fraction), fromValue))
      : storeFloat(subtract(fromValue, multiply(add(fromValue, toValue), fraction)))
  return Object.freeze([
    getComponent(fromX, toX),
    getComponent(fromY, toY),
    getComponent(fromZ, toZ),
    getComponent(fromW, toW),
  ] as const)
}

// 0x10024540: as `samplePosition`, with the quaternion blend; the result is not normalised here.
export const sampleRotation = (
  animation: SkeletalAnimation,
  track: AnimationTrack,
  time: number,
  frameCount: number
): RotationSample => {
  if (track.rotationCount === 0) return null
  const first = animation.rotations[track.rotationStart]
  if (track.rotationCount === 1) return first ?? null
  const interval = getKeyInterval(
    animation,
    track.rotationTimeStart,
    track.rotationCount,
    time,
    frameCount
  )
  const previous = animation.rotations[track.rotationStart + interval.previousKey]
  const next = animation.rotations[track.rotationStart + interval.nextKey]
  if (previous === undefined || next === undefined) return null
  return getBlendedQuaternion(previous, next, interval.fraction)
}

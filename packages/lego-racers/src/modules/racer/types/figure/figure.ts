import {
  getFloatFromBits,
  getTruncatedInteger,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type {
  Figure,
  FigureAnimation,
  FigureBlend,
  FigureBounds,
  FigureChild,
} from '../racer.types.ts'

const FIGURE_PLAYS_FLAG = 0x10000
const FIGURE_BLENDS_FLAG = 0x20000
const FIGURE_LOOPS_FLAG = 0x40000
const FIGURE_ENDED_FLAG = 0x80000
const FIGURE_CHAINS_FLAG = 0x100000
const FIGURE_TARGET_LOOPS_FLAG = 0x400000
const FIGURE_WRAPPED_FLAG = 0x2000000
const HALF = getFloatFromBits(0x3f000000) // 0x004af58c

export const FIGURE_BLEND_MILLISECONDS = 300

// The constructor 0x0040d530 (0x0040d5f0 and the frame's 0x00411150): nothing plays, the scale is 1.
export const createFigure = (
  animations: readonly FigureAnimation[],
  child: FigureChild | null
): Figure =>
  Object.freeze({
    flags: 0,
    currentId: 0,
    targetId: 0,
    currentTime: 0,
    currentRate: 0,
    targetTime: 0,
    targetRate: 0,
    blend: 0,
    blendRate: 0,
    isCurrentAdvancing: false,
    isTargetAdvancing: false,
    currentVector: ZERO_VECTOR3,
    targetVector: ZERO_VECTOR3,
    outputVector: ZERO_VECTOR3,
    scale: 1,
    animations: Object.freeze([...animations]),
    child,
  })

const getAnimation = (figure: Figure, id: number): FigureAnimation => {
  const animation = figure.animations[id]
  if (animation === undefined) throw new RangeError(`The figure has no animation ${String(id)}`)
  return animation
}

// The id a figure shows: the target while blending, else the current one.
export const getFigureAnimationId = (figure: Figure): number =>
  (figure.flags & FIGURE_BLENDS_FLAG) === 0 ? figure.currentId : figure.targetId

// 0x0040dad0 -> 0x0040dae0 (id, no start time): the animation starts at once, looping.
export const playFigureAnimation = (figure: Figure, id: number): Figure => {
  const animation = getAnimation(figure, id)
  return Object.freeze({
    ...figure,
    flags: (figure.flags & 0xffa5ffff) | FIGURE_LOOPS_FLAG,
    currentId: id,
    currentRate: animation.rate,
    currentTime: 0,
    currentVector: animation.vector,
    outputVector: animation.vector,
  })
}

// Plays the animation once and then chains to `nextId`: 0x0040dad0, then the target id +0xd8 and flags 0x500000.
export const chainFigureAnimation = (figure: Figure, id: number, nextId: number): Figure => {
  const played = playFigureAnimation(figure, id)
  return Object.freeze({
    ...played,
    targetId: nextId,
    flags: (played.flags & 0xfff1ffff) | FIGURE_CHAINS_FLAG | FIGURE_TARGET_LOOPS_FLAG,
  })
}

// 0x0040db80 with a duration (id, 300 ms, start 0, current advances, target advances, target loops): the figure
// blends from what it shows to the animation. A blend in progress is first completed.
export const blendFigureAnimation = (figure: Figure, id: number): Figure => {
  if (id === getFigureAnimationId(figure)) return figure
  const animation = getAnimation(figure, id)
  const settled: Figure =
    (figure.flags & FIGURE_BLENDS_FLAG) === 0
      ? figure
      : Object.freeze({
          ...figure,
          currentRate: figure.targetRate,
          currentTime: figure.targetTime,
          currentId: figure.targetId,
          currentVector: figure.targetVector,
          outputVector: figure.targetVector,
          flags:
            (figure.flags & FIGURE_TARGET_LOOPS_FLAG) === 0
              ? figure.flags & ~FIGURE_LOOPS_FLAG
              : figure.flags | FIGURE_LOOPS_FLAG,
        })
  return Object.freeze({
    ...settled,
    flags: (settled.flags & 0xffa7ffff) | FIGURE_BLENDS_FLAG | FIGURE_TARGET_LOOPS_FLAG,
    targetId: id,
    targetRate: animation.rate,
    blend: 0,
    targetTime: 0,
    blendRate: 1 / FIGURE_BLEND_MILLISECONDS,
    isCurrentAdvancing: true,
    isTargetAdvancing: true,
    targetVector: animation.vector,
  })
}

// 0x00401150 (thiscall on the animation record: time): a time past the period wraps by whole periods.
const getWrappedTime = (
  arithmetic: FloatArithmetic,
  animation: FigureAnimation,
  time: number
): number => {
  const { subtract, multiply, divide, getIsBelow } = arithmetic
  if (getIsBelow(time, animation.period)) return time
  return subtract(
    time,
    multiply(animation.period, getTruncatedInteger(divide(time, animation.period)))
  )
}

// The time of a blended animation after `rate · step` (0x0040de6f..0x0040dee4): FST stores it, and past the last frame
// it wraps (looping) or stops at the last frame.
const getBlendedTime = (
  arithmetic: FloatArithmetic,
  animation: FigureAnimation,
  time: number,
  rate: number,
  stepFloat: number,
  isLooping: boolean
): number => {
  const { add, multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  const unrounded = add(multiply(rate, stepFloat), time)
  const stored = storeFloat(unrounded)
  const lastFrame = animation.frameCount - 1
  if (getIsBelowOrEqual(unrounded, lastFrame)) return stored
  return isLooping ? storeFloat(getWrappedTime(arithmetic, animation, stored)) : lastFrame
}

// 0x0040dd96..0x0040dfce: the blend moves on by `blend rate · step`. A finished blend makes the target the current
// animation and returns the milliseconds left over; one in progress advances both times and mixes the vectors.
const getBlendedFigure = (
  arithmetic: FloatArithmetic,
  figure: Figure,
  step: number
): FigureBlend => {
  const { add, subtract, multiply, divide, storeFloat, getIsBelow } = arithmetic
  const stepFloat = storeFloat(step)
  const unrounded = add(multiply(figure.blendRate, stepFloat), figure.blend)
  const blend = storeFloat(unrounded)
  if (!getIsBelow(unrounded, 1)) {
    const surplus = getTruncatedInteger(divide(subtract(unrounded, 1), figure.blendRate))
    const kept = figure.flags & 0xffe9ffff
    return {
      figure: Object.freeze({
        ...figure,
        blend,
        currentRate: figure.targetRate,
        currentId: figure.targetId,
        currentTime: figure.targetTime,
        currentVector: figure.targetVector,
        outputVector: figure.targetVector,
        flags: (kept & FIGURE_TARGET_LOOPS_FLAG) === 0 ? kept : kept | FIGURE_LOOPS_FLAG,
      }),
      remainingMilliseconds: step - surplus,
    }
  }
  const currentTime = figure.isCurrentAdvancing
    ? getBlendedTime(
        arithmetic,
        getAnimation(figure, figure.currentId),
        figure.currentTime,
        figure.currentRate,
        stepFloat,
        (figure.flags & FIGURE_LOOPS_FLAG) !== 0
      )
    : figure.currentTime
  const targetTime = figure.isTargetAdvancing
    ? getBlendedTime(
        arithmetic,
        getAnimation(figure, figure.targetId),
        figure.targetTime,
        figure.targetRate,
        stepFloat,
        (figure.flags & FIGURE_TARGET_LOOPS_FLAG) !== 0
      )
    : figure.targetTime
  const { currentVector: from, targetVector: to } = figure
  const difference = {
    x: storeFloat(subtract(to.x, from.x)),
    y: storeFloat(subtract(to.y, from.y)),
    z: storeFloat(subtract(to.z, from.z)),
  }
  const scaledX = storeFloat(multiply(blend, difference.x))
  const scaledY = storeFloat(multiply(difference.y, blend))
  const scaledZ = multiply(blend, difference.z)
  return {
    figure: Object.freeze({
      ...figure,
      blend,
      currentTime,
      targetTime,
      outputVector: Object.freeze({
        x: storeFloat(add(scaledX, from.x)),
        y: storeFloat(add(scaledY, from.y)),
        z: storeFloat(add(scaledZ, from.z)),
      }),
    }),
    remainingMilliseconds: step,
  }
}

// 0x0040dfce..0x0040e09b: a figure that is not blending advances its time by `rate · milliseconds`; reaching the
// last frame wraps it (looping), chains to the next animation (flag 0x100000) or stops there (flag 0x80000).
const getAdvancedFigure = (
  arithmetic: FloatArithmetic,
  figure: Figure,
  milliseconds: number
): Figure => {
  const { add, multiply, storeFloat, getIsBelow } = arithmetic
  if ((figure.flags & FIGURE_BLENDS_FLAG) !== 0) return figure
  const animation = getAnimation(figure, figure.currentId)
  const unrounded = add(multiply(figure.currentRate, milliseconds), figure.currentTime)
  const stored = storeFloat(unrounded)
  const lastFrame = animation.frameCount - 1
  const advanced = Object.freeze({ ...figure, currentTime: stored })
  if (getIsBelow(unrounded, lastFrame)) return advanced
  if ((figure.flags & FIGURE_LOOPS_FLAG) !== 0) {
    const wrapped = getWrappedTime(arithmetic, animation, stored)
    return Object.freeze({
      ...advanced,
      currentTime: storeFloat(wrapped),
      flags: getIsBelow(wrapped, stored) ? figure.flags | FIGURE_WRAPPED_FLAG : figure.flags,
    })
  }
  const ended =
    (figure.flags & FIGURE_CHAINS_FLAG) === 0
      ? Object.freeze({ ...advanced, currentTime: lastFrame })
      : playFigureAnimation(advanced, advanced.targetId)
  return Object.freeze({ ...ended, flags: ended.flags | FIGURE_ENDED_FLAG })
}

// Figure slot 4, 0x0040dd60 (thiscall: milliseconds). Without the bones update (0x00411470), which is presentation.
export const updateFigure = (arithmetic: FloatArithmetic, figure: Figure, step: number): Figure => {
  const cleared = Object.freeze({ ...figure, flags: figure.flags & ~FIGURE_WRAPPED_FLAG })
  if ((cleared.flags & FIGURE_PLAYS_FLAG) === 0) return cleared
  if ((cleared.flags & FIGURE_BLENDS_FLAG) === 0)
    return getAdvancedFigure(arithmetic, cleared, step)
  const blended = getBlendedFigure(arithmetic, cleared, step)
  return getAdvancedFigure(arithmetic, blended.figure, blended.remainingMilliseconds)
}

// 0x0040e0b0 (slot 0x4c, index 0): the bounding sphere in the figure's own space. While it plays, the centre and
// radius come from the current animation, averaged with the target's when blending (the radius grows by the
// distance to the mean); the model part's radius scale and the figure's scale then multiply both. Without a
// model part the radius is 0.
export const getFigureBounds = (
  arithmetic: FloatArithmetic,
  figure: Figure
): FigureBounds | null => {
  const { add, subtract, multiply, getSquareRoot, storeFloat, getIsBelow } = arithmetic
  const { child } = figure
  if (child === null) return null
  if ((figure.flags & FIGURE_PLAYS_FLAG) === 0) {
    return getScaledBounds(arithmetic, figure.scale, child.centre, child.radius)
  }
  const current = getAnimation(figure, figure.currentId)
  const scale = storeFloat(multiply(child.radiusScale, figure.scale))
  if ((figure.flags & FIGURE_BLENDS_FLAG) === 0) {
    return getScaledBounds(arithmetic, scale, current.boundsCentre, current.boundsRadius)
  }
  const target = getAnimation(figure, figure.targetId)
  const mean = {
    x: storeFloat(multiply(add(target.boundsCentre.x, current.boundsCentre.x), HALF)),
    y: storeFloat(multiply(add(target.boundsCentre.y, current.boundsCentre.y), HALF)),
    z: storeFloat(multiply(add(target.boundsCentre.z, current.boundsCentre.z), HALF)),
  }
  const radius = getIsBelow(current.boundsRadius, target.boundsRadius)
    ? target.boundsRadius
    : current.boundsRadius
  const x = subtract(mean.x, target.boundsCentre.x)
  const y = subtract(mean.y, target.boundsCentre.y)
  const z = subtract(mean.z, target.boundsCentre.z)
  const distance = getSquareRoot(add(add(multiply(z, z), multiply(y, y)), multiply(x, x)))
  return getScaledBounds(arithmetic, scale, mean, storeFloat(add(radius, distance)))
}

const getScaledBounds = (
  arithmetic: FloatArithmetic,
  scale: number,
  centre: Vector3,
  radius: number
): FigureBounds => {
  const { multiply, storeFloat } = arithmetic
  return {
    centre: Object.freeze({
      x: storeFloat(multiply(scale, centre.x)),
      y: storeFloat(multiply(centre.y, scale)),
      z: storeFloat(multiply(centre.z, scale)),
    }),
    radius: storeFloat(multiply(scale, radius)),
  }
}

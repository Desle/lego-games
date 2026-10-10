import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { BrickState } from '../power-up-effect-kind/power-up-effect-kind.ts'
import type { BrickBase } from '../power-ups.types.ts'

// 0x004b14c8, 0x004b0400, 0x004af388.
const GROW_SCALE_PER_MILLISECOND = Math.fround(0.0025)
const SETTLE_SCALE_PER_MILLISECOND = Math.fround(0.002)
// 0x004b14ac: the scale of a brick that can be collected (0x00453ad0).
export const AVAILABLE_BRICK_SCALE = Math.fround(0.8)
// 0x004c75f4 = 1.0f / 100.0f and 0x004c75f8 = 100.0f * 0.004f, computed by CRT initialisers 0x004538c0 and 0x004538f0.
const SHRINK_FIRST_FACTOR = Math.fround(1 / 100)
const SHRINK_SECOND_FACTOR = Math.fround(100 * Math.fround(0.004))
// 0x190, 0x1f4, 0xfa in 0x00453a20.
const GROW_END_MILLISECONDS = 400
const SETTLE_END_MILLISECONDS = 500
export const COLLECT_ANIMATION_MILLISECONDS = 250

export const toVector3 = (position: readonly [number, number, number]): Vector3 =>
  Object.freeze({ x: position[0], y: position[1], z: position[2] })

// 0x00453970 (constructor defaults) then 0x004539b0 (placement): hidden, timer 3000.
export const createBrickBase = (position: Vector3): BrickBase =>
  Object.freeze({
    position,
    state: BrickState.HIDDEN,
    timerMilliseconds: 3000,
    scale: 1,
    isSoundEnabled: false,
    isTouchedThisFrame: false,
    isTouchedLastFrame: false,
  })

const getAnimatedScale = (
  arithmetic: FloatArithmetic,
  base: BrickBase,
  timerMilliseconds: number
): number => {
  const { multiply, subtract, storeFloat } = arithmetic
  if (base.state === BrickState.APPEARING) {
    if (timerMilliseconds < GROW_END_MILLISECONDS) {
      return storeFloat(multiply(timerMilliseconds | 0, GROW_SCALE_PER_MILLISECOND))
    }
    if (timerMilliseconds >= SETTLE_END_MILLISECONDS) return base.scale
    return storeFloat(
      subtract(
        1,
        multiply((timerMilliseconds - GROW_END_MILLISECONDS) | 0, SETTLE_SCALE_PER_MILLISECOND)
      )
    )
  }
  if (base.state !== BrickState.COLLECTED || timerMilliseconds > COLLECT_ANIMATION_MILLISECONDS) {
    return base.scale
  }
  // FILD, FMUL [0x004c75f8], FLD [0x004c75f4], FMUL [0x004b14ac], FMULP.
  const remaining = multiply(
    (COLLECT_ANIMATION_MILLISECONDS - timerMilliseconds) | 0,
    SHRINK_SECOND_FACTOR
  )
  return storeFloat(multiply(multiply(SHRINK_FIRST_FACTOR, AVAILABLE_BRICK_SCALE), remaining))
}

// 0x00453a20: advances the unsigned timer, animates the scale and ages the touch flags; nothing for an unused brick.
export const advanceBrickBase = <Brick extends BrickBase>(
  arithmetic: FloatArithmetic,
  brick: Brick,
  stepMilliseconds: number
): Brick => {
  if (brick.state === BrickState.UNUSED) return brick
  const timerMilliseconds = (brick.timerMilliseconds + stepMilliseconds) >>> 0
  return Object.freeze({
    ...brick,
    timerMilliseconds,
    scale: getAnimatedScale(arithmetic, brick, timerMilliseconds),
    isTouchedThisFrame: false,
    isTouchedLastFrame: brick.isTouchedThisFrame,
  })
}

export const getIsBrickCollectable = (
  brick: BrickBase,
  isRacerWarping: boolean,
  isRacerHoldingNothing: boolean
): boolean =>
  brick.state === BrickState.AVAILABLE &&
  !isRacerWarping &&
  (!brick.isTouchedLastFrame || isRacerHoldingNothing)

// 0x00453af0, the part before the collect call: the touch flag is always set.
export const getTouchedBrick = <Brick extends BrickBase>(brick: Brick): Brick =>
  Object.freeze({ ...brick, isTouchedThisFrame: true })

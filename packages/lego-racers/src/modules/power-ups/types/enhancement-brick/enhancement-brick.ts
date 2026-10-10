import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import {
  advanceBrickBase,
  AVAILABLE_BRICK_SCALE,
  COLLECT_ANIMATION_MILLISECONDS,
  createBrickBase,
  toVector3,
} from '../brick-base/brick-base.ts'
import { BrickState } from '../power-up-effect-kind/power-up-effect-kind.ts'
import type { EnhancementBrick, EnhancementBrickPlacement } from '../power-ups.types.ts'
import type { GroundQuery } from './enhancement-brick.types.ts'

// 500 and 10000 in 0x00453690.
const APPEAR_END_MILLISECONDS = 500
const DROPPED_RETURN_MILLISECONDS = 10000
// 0x004b1488 and 0x004b1480 in 0x00453840.
const GROUND_PROBE_HALF_HEIGHT = 25
const DROP_HEIGHT = 5

// 0x00458e80 → 0x004535a0 (constructor), 0x004539b0 (placement), 0x00453620 (home position, appearing).
export const createEnhancementBrick = (placement: EnhancementBrickPlacement): EnhancementBrick => {
  const position = toVector3(placement.position)
  return Object.freeze({
    ...createBrickBase(position),
    state: BrickState.APPEARING,
    homePosition: position,
    droppedMilliseconds: 0,
    isDropped: false,
    isReturningHome: false,
  })
}

// 0x004537f0: back to its home; a brick still on the track first plays the collect animation.
export const releaseEnhancementBrick = (brick: EnhancementBrick): EnhancementBrick => {
  const cleared = { ...brick, isDropped: false, droppedMilliseconds: 0, timerMilliseconds: 0 }
  if (brick.state === BrickState.AVAILABLE) {
    return Object.freeze({ ...cleared, state: BrickState.COLLECTED, isReturningHome: true })
  }
  return Object.freeze({ ...cleared, position: brick.homePosition, state: BrickState.APPEARING })
}

// 0x00453690 (called by 0x0045a3f0 every frame).
export const advanceEnhancementBrick = (
  arithmetic: FloatArithmetic,
  brick: EnhancementBrick,
  stepMilliseconds: number
): EnhancementBrick => {
  if (brick.state === BrickState.UNUSED) return brick
  const advanced = advanceBrickBase(arithmetic, brick, stepMilliseconds)
  const droppedMilliseconds = (advanced.droppedMilliseconds + stepMilliseconds) >>> 0
  const afterDrop = !advanced.isDropped
    ? advanced
    : droppedMilliseconds > DROPPED_RETURN_MILLISECONDS
      ? releaseEnhancementBrick(advanced)
      : Object.freeze({ ...advanced, droppedMilliseconds })
  if (afterDrop.state === BrickState.APPEARING) {
    if (afterDrop.timerMilliseconds <= APPEAR_END_MILLISECONDS) return afterDrop
    return Object.freeze({
      ...afterDrop,
      state: BrickState.AVAILABLE,
      timerMilliseconds: 0,
      scale: AVAILABLE_BRICK_SCALE,
    })
  }
  if (
    afterDrop.state !== BrickState.COLLECTED ||
    afterDrop.timerMilliseconds <= COLLECT_ANIMATION_MILLISECONDS
  ) {
    return afterDrop
  }
  if (afterDrop.isReturningHome) {
    return Object.freeze({
      ...afterDrop,
      isReturningHome: false,
      position: afterDrop.homePosition,
      state: BrickState.APPEARING,
      timerMilliseconds: 0,
      scale: 0,
    })
  }
  return Object.freeze({ ...afterDrop, state: BrickState.HIDDEN, timerMilliseconds: 0, scale: 0 })
}

// 0x00453750 after the racer accepted it (0x00439420).
export const collectEnhancementBrick = (brick: EnhancementBrick): EnhancementBrick =>
  Object.freeze({
    ...brick,
    state: BrickState.COLLECTED,
    timerMilliseconds: 0,
    isDropped: false,
    droppedMilliseconds: 0,
  })

// 0x00453840: a vertical probe 25 above to 25 below, then 5 above whatever it hit.
export const getDropPosition = (
  arithmetic: FloatArithmetic,
  position: Vector3,
  getGroundPoint: GroundQuery
): Vector3 => {
  const { add, subtract, storeFloat } = arithmetic
  const start = Object.freeze({
    ...position,
    z: storeFloat(add(GROUND_PROBE_HALF_HEIGHT, position.z)),
  })
  const end = Object.freeze({
    ...position,
    z: storeFloat(subtract(position.z, GROUND_PROBE_HALF_HEIGHT)),
  })
  const ground = getGroundPoint(start, end) ?? position
  return Object.freeze({ ...ground, z: storeFloat(add(DROP_HEIGHT, ground.z)) })
}

// 0x00453790, called by 0x00439490 with the hit racer's position.
export const dropEnhancementBrick = (
  arithmetic: FloatArithmetic,
  brick: EnhancementBrick,
  racerPosition: Vector3,
  getGroundPoint: GroundQuery
): EnhancementBrick =>
  Object.freeze({
    ...brick,
    position: getDropPosition(arithmetic, racerPosition, getGroundPoint),
    state: BrickState.APPEARING,
    timerMilliseconds: 0,
    isDropped: true,
  })

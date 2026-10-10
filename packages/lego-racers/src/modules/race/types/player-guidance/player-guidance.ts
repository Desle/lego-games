import type { Checkpoint } from '../../../checkpoint/index.ts'
import type { Racer } from '../../../racer/index.ts'
import { getNormalizedVector3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { PlayerGuidanceInput, WrongWayStep } from './player-guidance.types.ts'

const NO_LINK = 0xff
// Racer +0xd04 bits 0x2000 and 0x4000: the wrong-way warning is pending, and showing.
const WRONG_WAY_PENDING_FLAG = 0x2000
const WRONG_WAY_FLAG = 0x4000
const WARPING_FLAG = 0x10
const WRONG_WAY_FLAGS = WRONG_WAY_PENDING_FLAG | WRONG_WAY_FLAG
// Racer +0xd04 bits 0x8000 (a target is set by 0x00439e60), 0x10000 and 0x20000 (the target is to one side).
const TARGET_SET_FLAG = 0x8000
const TARGET_LEFT_FLAG = 0x10000
const TARGET_RIGHT_FLAG = 0x20000
const WRONG_WAY_MILLISECONDS = 500
// float32 0.2 at 0x004b02e0 and 0.5 at 0x004af58c.
const FACING_LIMIT = Math.fround(0.2)
const TARGET_AHEAD_LIMIT = 0.5

// (z·z + y·y) + x·x, the order of the FMUL and FADDP chains at 0x00439d94 and 0x00439f25.
const getDot = (arithmetic: FloatArithmetic, first: Vector3, second: Vector3): number => {
  const { add, multiply } = arithmetic
  return add(
    add(multiply(first.z, second.z), multiply(first.y, second.y)),
    multiply(first.x, second.x)
  )
}

const getIsAnyLinkFacingForward = (
  arithmetic: FloatArithmetic,
  checkpoint: Checkpoint,
  heading: Vector3
): boolean => {
  // 0x00439d88 fetches each linked checkpoint but 0x00439d8e reloads racer +0xcc4: every link tests the racer's own.
  const isLinked = checkpoint.links.slice(0, 4).some((link) => link !== NO_LINK)
  if (!isLinked) return false
  const [x, y, z] = checkpoint.plane
  return arithmetic.getIsBelowOrEqual(getDot(arithmetic, heading, { x, y, z }), FACING_LIMIT)
}

// 0x00439cf0 (thiscall: step): the wrong-way warning of a player. It starts when the car points along
// the checkpoint plane's normal (dot above 0.2), lasts while it does and ends 500 ms after it stops.
export const getRacerAfterWrongWayCheck = (
  input: PlayerGuidanceInput,
  racer: Racer
): WrongWayStep => {
  const { arithmetic, checkpoints, stepMilliseconds } = input
  const checkpoint = checkpoints[racer.checkpointIndex]
  if (checkpoint === undefined) return racer
  if ((racer.flags & WARPING_FLAG) !== 0) {
    return Object.freeze({
      ...racer,
      wrongWayMilliseconds: 0,
      flags: racer.flags & ~WRONG_WAY_FLAGS,
    })
  }
  const isCountingDown = racer.wrongWayMilliseconds !== 0
  const isTimedOut = isCountingDown && stepMilliseconds >= racer.wrongWayMilliseconds
  const counted = Object.freeze({
    ...racer,
    flags: isTimedOut ? racer.flags & ~WRONG_WAY_FLAG : racer.flags,
    wrongWayMilliseconds: !isCountingDown
      ? racer.wrongWayMilliseconds
      : isTimedOut
        ? 0
        : racer.wrongWayMilliseconds - stepMilliseconds,
  })
  const isFacingForward = getIsAnyLinkFacingForward(
    arithmetic,
    checkpoint,
    racer.carBody.rigidBody.heading
  )
  if ((counted.flags & WRONG_WAY_PENDING_FLAG) !== 0) {
    if (isFacingForward) {
      return Object.freeze({
        ...counted,
        wrongWayMilliseconds: 0,
        flags: counted.flags & ~WRONG_WAY_PENDING_FLAG,
      })
    }
    return counted.wrongWayMilliseconds === 0
      ? Object.freeze({
          ...counted,
          flags: (counted.flags & ~WRONG_WAY_PENDING_FLAG) | WRONG_WAY_FLAG,
        })
      : counted
  }
  if ((counted.flags & WRONG_WAY_FLAG) === 0) {
    return isFacingForward
      ? counted
      : Object.freeze({
          ...counted,
          flags: counted.flags | WRONG_WAY_PENDING_FLAG,
          wrongWayMilliseconds: WRONG_WAY_MILLISECONDS,
        })
  }
  return isFacingForward
    ? counted
    : Object.freeze({ ...counted, wrongWayMilliseconds: WRONG_WAY_MILLISECONDS })
}

// 0x00439ea0: with a target set (flag 0x8000), flags 0x10000 or 0x20000 say on which side of the heading it lies
// when it is not ahead (dot below 0.5). The target is racer +0xdf8, which nothing in the race module sets.
export const getRacerAfterTargetGuidance = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  target: Vector3 | null
): Racer => {
  const cleared = Object.freeze({
    ...racer,
    flags: racer.flags & ~(TARGET_LEFT_FLAG | TARGET_RIGHT_FLAG),
  })
  if ((racer.flags & TARGET_SET_FLAG) === 0 || target === null) return cleared
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const { heading, displayFrame } = racer.carBody.rigidBody
  const { position } = displayFrame
  const direction = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(target.x, position.x)),
    y: storeFloat(subtract(target.y, position.y)),
    z: storeFloat(subtract(target.z, position.z)),
  })
  if (!getIsBelow(getDot(arithmetic, heading, direction), TARGET_AHEAD_LIMIT)) return cleared
  const side = add(
    add(multiply(0, direction.z), multiply(subtract(0, heading.x), direction.y)),
    multiply(subtract(heading.y, 0), direction.x)
  )
  return Object.freeze({
    ...cleared,
    flags: cleared.flags | (getIsBelowOrEqual(side, 0) ? TARGET_RIGHT_FLAG : TARGET_LEFT_FLAG),
  })
}

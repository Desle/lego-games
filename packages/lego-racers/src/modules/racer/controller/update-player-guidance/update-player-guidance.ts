import type { Checkpoint } from '../../../checkpoint/index.ts'
import { getFloatFromBits, getNormalizedVector3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type { Racer, RacerBoundary } from '../../types/racer.types.ts'

const NO_LINK = 0xff
const RACER_DISABLED_FLAG = 0x10
const WRONG_WAY_WARNING_FLAG = 0x2000
const WRONG_WAY_FLAG = 0x4000
const WRONG_WAY_FLAGS = WRONG_WAY_WARNING_FLAG | WRONG_WAY_FLAG
const GUIDED_FLAG = 0x8000
const TARGET_LEFT_FLAG = 0x10000
const TARGET_RIGHT_FLAG = 0x20000
const WRONG_WAY_DELAY_MILLISECONDS = 500
const WRONG_WAY_ALIGNMENT = getFloatFromBits(0x3e4ccccd) // 0x004b02e0, 0.2
const TARGET_ALIGNMENT = getFloatFromBits(0x3f000000) // 0x004af58c, 0.5

// 0x00439cf0 (thiscall: milliseconds). Without a checkpoint nothing happens. A racer with flag 0x10
// loses its wrong-way state. Otherwise the countdown +0xd78 runs, and the racer is found to drive
// the right way when one of the checkpoint's links exists and the heading's dot product with the
// CURRENT checkpoint's plane normal (the loop calls 0x0041e940 for the link but never reads its
// result) is at most 0.2. 0x2000 (warning) turns into 0x4000 (wrong way) after 500 ms, both clear
// when the way is right, and 0x2000 starts the countdown when it is not.
const getWithWrongWay = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  checkpoint: Checkpoint,
  stepMilliseconds: number
): Racer => {
  const { add, multiply, getIsBelowOrEqual } = arithmetic
  if ((racer.flags & RACER_DISABLED_FLAG) !== 0) {
    return Object.freeze({
      ...racer,
      wrongWayMilliseconds: 0,
      flags: racer.flags & ~WRONG_WAY_FLAGS,
    })
  }
  const isRunning = racer.wrongWayMilliseconds !== 0
  const isExpired = isRunning && stepMilliseconds >= racer.wrongWayMilliseconds
  const countdown = !isRunning
    ? racer.wrongWayMilliseconds
    : isExpired
      ? 0
      : racer.wrongWayMilliseconds - stepMilliseconds
  const flags = isExpired ? racer.flags & ~WRONG_WAY_FLAG : racer.flags
  const [a, b, c] = checkpoint.plane
  const { heading } = racer.carBody.rigidBody
  const alignment = add(add(multiply(c, heading.z), multiply(b, heading.y)), multiply(heading.x, a))
  const isRight =
    checkpoint.links.slice(0, 4).some((link) => link !== NO_LINK) &&
    getIsBelowOrEqual(alignment, WRONG_WAY_ALIGNMENT)
  const withCountdown = (changedFlags: number, changedCountdown: number): Racer =>
    Object.freeze({
      ...racer,
      flags: changedFlags,
      wrongWayMilliseconds: changedCountdown,
    })
  if ((flags & WRONG_WAY_WARNING_FLAG) !== 0) {
    if (isRight) return withCountdown(flags & ~WRONG_WAY_WARNING_FLAG, 0)
    if (countdown === 0) {
      return withCountdown((flags & ~WRONG_WAY_WARNING_FLAG) | WRONG_WAY_FLAG, countdown)
    }
    return withCountdown(flags, countdown)
  }
  if ((flags & WRONG_WAY_FLAG) === 0) {
    return isRight
      ? withCountdown(flags, countdown)
      : withCountdown(flags | WRONG_WAY_WARNING_FLAG, WRONG_WAY_DELAY_MILLISECONDS)
  }
  return withCountdown(flags, isRight ? countdown : WRONG_WAY_DELAY_MILLISECONDS)
}

// 0x00439ea0: flags 0x10000 and 0x20000 are cleared; with flag 0x8000 the target +0xdf8 is compared with the
// heading: when the heading is not within 0.5 of the direction to the target (normalized, the
// differences stored), the sign of (0 · z + (-heading.x) · y) + heading.y · x says which side it is on.
const getWithTargetSide = (arithmetic: FloatArithmetic, racer: Racer): Racer => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const cleared = Object.freeze({
    ...racer,
    flags: racer.flags & ~(TARGET_LEFT_FLAG | TARGET_RIGHT_FLAG),
  })
  if ((racer.flags & GUIDED_FLAG) === 0) return cleared
  const { heading } = racer.carBody.rigidBody
  const { position } = racer.carBody.rigidBody.displayFrame
  const direction: Vector3 = getNormalizedVector3(
    arithmetic,
    Object.freeze({
      x: storeFloat(subtract(racer.guidanceTarget.x, position.x)),
      y: storeFloat(subtract(racer.guidanceTarget.y, position.y)),
      z: storeFloat(subtract(racer.guidanceTarget.z, position.z)),
    })
  )
  const alignment = add(
    add(multiply(heading.z, direction.z), multiply(heading.y, direction.y)),
    multiply(heading.x, direction.x)
  )
  if (!getIsBelow(alignment, TARGET_ALIGNMENT)) return cleared
  const storedY = storeFloat(subtract(heading.y, 0))
  const side = add(
    add(multiply(0, direction.z), multiply(subtract(0, heading.x), direction.y)),
    multiply(storedY, direction.x)
  )
  return Object.freeze({
    ...cleared,
    flags: cleared.flags | (getIsBelowOrEqual(side, 0) ? TARGET_RIGHT_FLAG : TARGET_LEFT_FLAG),
  })
}

// Pass 7 step 8 for a player, 0x00439cf0 then 0x00439ea0.
export const updatePlayerGuidance: RacerBoundary = (
  context,
  racerSet,
  racerIndex,
  stepMilliseconds
) => {
  const racer = getRacer(racerSet, racerIndex)
  const checkpoint = context.checkpoints[racer.checkpointIndex]
  const wrongWay =
    checkpoint === undefined
      ? racer
      : getWithWrongWay(context.arithmetic, racer, checkpoint, stepMilliseconds)
  return setRacer(racerSet, racerIndex, getWithTargetSide(context.arithmetic, wrongWay))
}

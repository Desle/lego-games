import { getNormalizedVector3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import {
  advanceBallisticFlight,
  BallisticFlightState,
} from '../ballistic-flight/ballistic-flight.ts'
import type { BallisticFlight } from '../ballistic-flight/ballistic-flight.types.ts'
import type { LineProbe } from '../projectiles.types.ts'
import type { GrappleAdvance, GrappleHook, PointMove } from './grapple-hook.types.ts'

// 0x004af220.
const SECONDS_PER_MILLISECOND = Math.fround(0.001)
// 0x004b0c90: the hook ends 2 units above the latched racer.
const LATCH_HEIGHT = 2
// 0x004b0c94 and 0x004b0c8c: the hook flies to the latched racer at 300 units a second and arrives within
// the square root of 2 units.
const LATCH_ARRIVAL_DISTANCE_SQUARED = 2
const LATCH_SPEED = 300
// 0x004b0c98 and 0x004b0ca0: the retracting hook flies back at 250 units a second and arrives within 6 units.
const RETRACT_ARRIVAL_DISTANCE_SQUARED = 36
const RETRACT_SPEED = 250
// 0x004b0c9c: the tension grows by this per second; the probe starts at 1.
const TENSION_PER_SECOND = 1
const FULL_TENSION = 1
// +0x218 (0x00444340 copies it from the block 0x00453cd0 builds, 3.0): the rope starts this high above the owner.
export const ROPE_START_HEIGHT = 3

export const createGrappleHook = (flight: BallisticFlight): GrappleHook =>
  Object.freeze({
    flight,
    hookTarget: ZERO_VECTOR3,
    isRetracting: false,
    isHookArrived: false,
    tension: 0,
    ropeOwnerPosition: ZERO_VECTOR3,
  })

// 0x00449a90 (cdecl: target, position, arrival distance squared, speed, seconds): moves the position towards the
// target, and tells whether it is there (already within the distance, or past the target along the line).
export const getPointMovedToward = (
  arithmetic: FloatArithmetic,
  target: Vector3,
  position: Vector3,
  arrivalDistanceSquared: number,
  speed: number,
  seconds: number
): PointMove => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const differenceX = storeFloat(subtract(target.x, position.x))
  const differenceY = storeFloat(subtract(target.y, position.y))
  const rawDifferenceZ = subtract(target.z, position.z)
  const differenceZ = storeFloat(rawDifferenceZ)
  const distanceSquared = add(
    add(multiply(rawDifferenceZ, differenceZ), multiply(differenceY, differenceY)),
    multiply(differenceX, differenceX)
  )
  if (getIsBelow(distanceSquared, arrivalDistanceSquared)) return { position, isArrived: true }
  const direction = getNormalizedVector3(
    arithmetic,
    Object.freeze({ x: differenceX, y: differenceY, z: differenceZ })
  )
  const step = multiply(speed, seconds)
  const movedX = storeFloat(add(storeFloat(multiply(step, direction.x)), position.x))
  const movedY = storeFloat(add(storeFloat(multiply(direction.y, step)), position.y))
  const rawMovedZ = add(multiply(step, direction.z), position.z)
  const remainingX = storeFloat(subtract(target.x, movedX))
  const remainingY = storeFloat(subtract(target.y, movedY))
  const remainingZ = subtract(target.z, rawMovedZ)
  const remaining = add(
    add(multiply(remainingZ, direction.z), multiply(remainingY, direction.y)),
    multiply(remainingX, direction.x)
  )
  return {
    position: Object.freeze({ x: movedX, y: movedY, z: storeFloat(rawMovedZ) }),
    isArrived: getIsBelowOrEqual(remaining, 0),
  }
}

// 0x00444ac0: the hook starts back towards its owner from this point.
export const getRetractingHook = (hook: GrappleHook, point: Vector3): GrappleHook =>
  Object.freeze({ ...hook, hookTarget: point, isRetracting: true })

// 0x00444690: the retracting hook flies to the owner; 4 once it is there, else 1.
const advanceRetractingHook = (
  arithmetic: FloatArithmetic,
  hook: GrappleHook,
  ownerPosition: Vector3,
  stepMilliseconds: number
): GrappleAdvance => {
  const seconds = arithmetic.storeFloat(
    arithmetic.multiply(stepMilliseconds, SECONDS_PER_MILLISECOND)
  )
  const moved = getPointMovedToward(
    arithmetic,
    Object.freeze({
      x: ownerPosition.x,
      y: ownerPosition.y,
      z: arithmetic.storeFloat(arithmetic.add(ownerPosition.z, ROPE_START_HEIGHT)),
    }),
    hook.hookTarget,
    RETRACT_ARRIVAL_DISTANCE_SQUARED,
    RETRACT_SPEED,
    seconds
  )
  if (moved.isArrived) {
    return Object.freeze({
      hook: Object.freeze({ ...hook, hookTarget: moved.position, isRetracting: false }),
      result: BallisticFlightState.ENDED,
    })
  }
  // The rope slackens as the hook comes back: the tension falls by 1 a second and stops at 0.
  const slackened = arithmetic.storeFloat(
    arithmetic.subtract(hook.tension, arithmetic.multiply(TENSION_PER_SECOND, seconds))
  )
  return Object.freeze({
    hook: Object.freeze({
      ...hook,
      hookTarget: moved.position,
      tension: arithmetic.getIsBelow(slackened, 0) ? 0 : slackened,
    }),
    result: BallisticFlightState.FLYING,
  })
}

// 0x00444820: the hook that touched a racer flies to it, follows it, and breaks (3) when the rope between the owner
// and the hook meets the track once the tension has reached 1.
const advanceLatchedHook = (
  arithmetic: FloatArithmetic,
  probe: LineProbe,
  hook: GrappleHook,
  ownerPosition: Vector3,
  latchedPosition: Vector3,
  stepMilliseconds: number
): GrappleAdvance => {
  const { add, multiply, storeFloat, getIsBelow } = arithmetic
  const seconds = storeFloat(multiply(stepMilliseconds, SECONDS_PER_MILLISECOND))
  const latchedPoint = Object.freeze({
    x: latchedPosition.x,
    y: latchedPosition.y,
    z: storeFloat(add(LATCH_HEIGHT, latchedPosition.z)),
  })
  const approach = hook.isHookArrived
    ? { position: hook.flight.framePosition, isArrived: true }
    : getPointMovedToward(
        arithmetic,
        latchedPoint,
        hook.flight.framePosition,
        LATCH_ARRIVAL_DISTANCE_SQUARED,
        LATCH_SPEED,
        seconds
      )
  const isHookArrived = hook.isHookArrived || approach.isArrived
  const hookPosition = isHookArrived ? latchedPoint : approach.position
  const ropeStart = Object.freeze({
    x: ownerPosition.x,
    y: ownerPosition.y,
    z: storeFloat(add(ownerPosition.z, ROPE_START_HEIGHT)),
  })
  const tension = storeFloat(add(multiply(TENSION_PER_SECOND, seconds), hook.tension))
  const moved = Object.freeze({
    ...hook,
    isHookArrived,
    flight: Object.freeze({ ...hook.flight, framePosition: hookPosition }),
  })
  if (getIsBelow(tension, FULL_TENSION)) {
    return Object.freeze({ hook: Object.freeze({ ...moved, tension }), result: moved.flight.state })
  }
  const blocked = probe(ropeStart, hookPosition)
  if (blocked === null) {
    return Object.freeze({
      hook: Object.freeze({ ...moved, tension: FULL_TENSION }),
      result: moved.flight.state,
    })
  }
  return Object.freeze({
    hook: Object.freeze({
      ...moved,
      tension: FULL_TENSION,
      flight: Object.freeze({
        ...moved.flight,
        endPosition: blocked.point,
        hitNormal: blocked.normal,
      }),
    }),
    result: BallisticFlightState.HIT_GROUND,
  })
}

// 0x00444490 (the grapple body's advance): retracting, latched on a racer, or flying as a ballistic flight.
const advanceHookBody = (
  arithmetic: FloatArithmetic,
  probe: LineProbe,
  hook: GrappleHook,
  ownerPosition: Vector3,
  latchedPosition: Vector3 | null,
  stepMilliseconds: number
): GrappleAdvance => {
  if (hook.isRetracting) {
    return advanceRetractingHook(arithmetic, hook, ownerPosition, stepMilliseconds)
  }
  if (hook.flight.state === BallisticFlightState.TOUCHED_RACER && latchedPosition !== null) {
    return advanceLatchedHook(
      arithmetic,
      probe,
      hook,
      ownerPosition,
      latchedPosition,
      stepMilliseconds
    )
  }
  const advance = advanceBallisticFlight(arithmetic, probe, hook.flight, stepMilliseconds)
  return Object.freeze({
    hook: Object.freeze({ ...hook, flight: advance.flight }),
    result: advance.result,
  })
}

// The advance, and the owner's position it ran with: the rope is laid from there when the hook updates, before the
// racers move on (0x00444540, 0x00444690, 0x00444820 read the owner's frame position).
export const advanceGrappleHook = (
  arithmetic: FloatArithmetic,
  probe: LineProbe,
  hook: GrappleHook,
  ownerPosition: Vector3,
  latchedPosition: Vector3 | null,
  stepMilliseconds: number
): GrappleAdvance => {
  const advance = advanceHookBody(
    arithmetic,
    probe,
    hook,
    ownerPosition,
    latchedPosition,
    stepMilliseconds
  )
  return Object.freeze({
    hook: Object.freeze({ ...advance.hook, ropeOwnerPosition: ownerPosition }),
    result: advance.result,
  })
}

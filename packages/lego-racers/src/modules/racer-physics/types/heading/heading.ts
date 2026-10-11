import {
  getDotProduct,
  getFloatFromBits,
  getNormalizedVector3,
  getSineCosine,
  getStoredCrossProduct,
  getStoredScaledVector,
  getTruncatedInteger,
  getVectorRotatedAroundAxis,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getIsFlagSet, getRotationRow } from '../car-forces/car-forces.ts'
import { CarRigidBodyFlag } from '../car-rigid-body/car-rigid-body.ts'
import type { CarRigidBody } from '../racer-physics.types.ts'

const SNAP_ALIGNMENT = getFloatFromBits(0x3f7ae148) // 0x004b0d70, 0.98
const HEADING_TURN_RATE = getFloatFromBits(0x3b23d70a) // 0x004b0d74, 0.0025 per millisecond
const MINIMUM_TURN_SPEED = getFloatFromBits(0x3cf5c28f) // 0x004b0d18, 0.03
// 0x004af870 = 0xc3ffc000: the arccosine table index is _ftol((cosine + 1) × -511.5), negated.
const ARC_COSINE_INDEX_SCALE = getFloatFromBits(0xc3ffc000)
const ARC_COSINE_ENTRY_COUNT = 1024
// The table at 0x004c07ec is initialised data: entry k is fround(acos(-1 + k / 511.5)) in all but
// three entries, which are one unit in the last place lower in the executable.
const ARC_COSINE_EXCEPTIONS: ReadonlyMap<number, number> = new Map([
  [396, getFloatFromBits(0x3fe63772)],
  [681, getFloatFromBits(0x3f9dd400)],
  [830, getFloatFromBits(0x3f660cf6)],
])
const ARC_COSINE_TABLE: readonly number[] = Object.freeze(
  Array.from(
    { length: ARC_COSINE_ENTRY_COUNT },
    (_value, index) =>
      ARC_COSINE_EXCEPTIONS.get(index) ?? Math.fround(Math.acos(-1 + index / 511.5))
  )
)

// The lookup in 0x00446fd0 and 0x00447230: table[-_ftol((cosine + 1) × -511.5)]. A cosine below -1
// would read before the table (the end of the table at 0x004bf7ec); unit vectors never get there.
export const getTableArcCosine = (arithmetic: FloatArithmetic, cosine: number): number => {
  const index = -getTruncatedInteger(
    arithmetic.multiply(arithmetic.add(cosine, 1), ARC_COSINE_INDEX_SCALE)
  )
  return ARC_COSINE_TABLE[Math.min(Math.max(index, 0), ARC_COSINE_ENTRY_COUNT - 1)] ?? 0
}

const setHeading = (body: CarRigidBody, heading: Vector3): CarRigidBody =>
  Object.freeze({ ...body, heading })

// 0x00447230 (thiscall: step, target): the heading snaps to the target when they are within 0.98
// or the target is closer than step × 0.0025 radians; otherwise it turns that far toward it.
const turnHeadingToward = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number,
  target: Vector3
): CarRigidBody => {
  const { multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  const { heading } = body
  const alignment = getDotProduct(arithmetic, heading, target)
  if (!getIsBelowOrEqual(alignment, SNAP_ALIGNMENT)) return setHeading(body, target)
  const turn = multiply(stepMilliseconds, HEADING_TURN_RATE)
  if (!getIsBelowOrEqual(turn, getTableArcCosine(arithmetic, alignment))) {
    return setHeading(body, target)
  }
  const axis = getStoredCrossProduct(arithmetic, target, heading)
  return setHeading(
    body,
    getNormalizedVector3(
      arithmetic,
      getVectorRotatedAroundAxis(arithmetic, heading, axis, storeFloat(turn))
    )
  )
}

// 0x0044715c..0x004471b7 and 0x004471bf..0x0044720b: a drifting heading turns by step × yaw rate
// about the vertical, but never further than the drift's maximum angle from rotation row 0.
const getDriftHeading = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number,
  row0: Vector3
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  const { heading } = body
  const alignment = getDotProduct(arithmetic, heading, row0)
  const clamped = getIsBelowOrEqual(alignment, 1) ? alignment : 1
  const angle = getTableArcCosine(arithmetic, clamped)
  const unroundedTurn = multiply(body.yawRate, stepMilliseconds)
  const turn = storeFloat(unroundedTurn)
  const reached = getIsBelowOrEqual(unroundedTurn, 0) ? subtract(angle, turn) : add(angle, turn)
  if (!getIsBelowOrEqual(reached, body.driftMaximumAngle)) {
    const axis = getStoredCrossProduct(arithmetic, heading, row0)
    return setHeading(
      body,
      getNormalizedVector3(
        arithmetic,
        getVectorRotatedAroundAxis(arithmetic, row0, axis, body.driftMaximumAngle)
      )
    )
  }
  const { sine, cosine } = getSineCosine(arithmetic, turn)
  const turnedX = subtract(multiply(heading.x, cosine), multiply(heading.y, sine))
  return setHeading(
    body,
    getNormalizedVector3(arithmetic, {
      x: storeFloat(turnedX),
      y: storeFloat(add(multiply(heading.y, cosine), multiply(turnedX, sine))),
      z: heading.z,
    })
  )
}

// 0x00446fd0 (thiscall: step): the heading follows rotation row 0, laid into the ground plane
// with one or two wheels down; a drift under throttle with three or more down turns it instead.
export const updateHeading = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number
): CarRigidBody => {
  const { subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const row0 = getRotationRow(body, 0)
  if (body.groundedWheelCount === 0 || getIsBelow(body.forwardSpeed, MINIMUM_TURN_SPEED)) {
    return turnHeadingToward(arithmetic, body, stepMilliseconds, row0)
  }
  if (body.groundedWheelCount <= 2) {
    const { groundNormal } = body
    const along = getDotProduct(arithmetic, groundNormal, row0)
    const projection = getStoredScaledVector(arithmetic, groundNormal, along)
    const target = getNormalizedVector3(arithmetic, {
      x: storeFloat(subtract(row0.x, projection.x)),
      y: storeFloat(subtract(row0.y, projection.y)),
      z: storeFloat(subtract(row0.z, multiply(along, groundNormal.z))),
    })
    return turnHeadingToward(arithmetic, body, stepMilliseconds, target)
  }
  if (getIsFlagSet(body, CarRigidBodyFlag.DRIFTING) && !getIsBelowOrEqual(body.throttle, 0)) {
    return getDriftHeading(arithmetic, body, stepMilliseconds, row0)
  }
  return turnHeadingToward(arithmetic, body, stepMilliseconds, row0)
}

// 0x00447330: the speed and direction of the linear velocity (flag 0x100 when the body is at rest),
// and its split along the heading (+0x60c, +0x618) and across it (+0x61c).
export const getWithVelocitySplit = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody => {
  const { subtract, multiply, storeFloat, getSquareRoot, getIsEqual } = arithmetic
  const velocity = body.linearVelocity
  const getIsZero = (vector: Vector3): boolean =>
    getIsEqual(vector.x, 0) && getIsEqual(vector.y, 0) && getIsEqual(vector.z, 0)
  const isStill = getIsZero(velocity)
  const isAtRest = isStill && getIsZero(body.angularVelocity)
  const along = getDotProduct(arithmetic, velocity, body.heading)
  const forwardVelocity = getStoredScaledVector(arithmetic, body.heading, along)
  return Object.freeze({
    ...body,
    speed: isStill ? 0 : storeFloat(getSquareRoot(getDotProduct(arithmetic, velocity, velocity))),
    velocityDirection: isStill
      ? getRotationRow(body, 0)
      : getNormalizedVector3(arithmetic, velocity),
    flags: isAtRest
      ? body.flags | CarRigidBodyFlag.AT_REST
      : body.flags & ~CarRigidBodyFlag.AT_REST,
    forwardVelocity,
    forwardSpeed: storeFloat(along),
    lateralVelocity: Object.freeze({
      x: storeFloat(subtract(velocity.x, multiply(along, body.heading.x))),
      y: storeFloat(subtract(velocity.y, forwardVelocity.y)),
      z: storeFloat(subtract(velocity.z, forwardVelocity.z)),
    }),
  })
}

// 0x00446fa0: the heading becomes rotation row 0 of the frame, then 0x00447330 splits the velocity along it.
export const getWithHeadingFromFrame = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody =>
  getWithVelocitySplit(arithmetic, Object.freeze({ ...body, heading: getRotationRow(body, 0) }))

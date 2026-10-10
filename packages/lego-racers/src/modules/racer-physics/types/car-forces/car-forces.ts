import {
  getFloatFromBits,
  getNormalizedVector3,
  getStoredScaledVector,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { CarRigidBodyFlag } from '../car-rigid-body/car-rigid-body.ts'
import {
  addAngularVelocity,
  addForce,
  addTorqueOfForceAtPoint,
  removeAngularMomentumAgainstForce,
  removeAngularMomentumAlongAxis,
} from '../rigid-body-forces/rigid-body-forces.ts'
import { TwoPointModeNotPortedError } from '../two-point-mode/two-point-mode.ts'
import type { CarRigidBody, CarWheel, TurnYawRate } from '../racer-physics.types.ts'

// Constants of 0x00445500, by address.
const AIRBORNE_GRAVITY_FACTOR = getFloatFromBits(0x40800000) // 0x004b0d10
const WHEEL_AVERAGE = getFloatFromBits(0x3e800000) // 0x004b0ce0
const SIDE_FRICTION = getFloatFromBits(0xbc23d70a) // 0x004b0dec, -0.01
const SPIN_SIDE_FRICTION = getFloatFromBits(0xbb03126f) // 0x004b0de8, -0.002
const ROLLING_FRICTION = getFloatFromBits(0xba83126f) // 0x004af594, -0.001
const MINIMUM_TURN_SPEED = getFloatFromBits(0x3cf5c28f) // 0x004b0d18, 0.03
const CREEP_SPEED = getFloatFromBits(0x3a03126f) // 0x004b0d1c, 0.0005
// 0x00445640: the yaw-rate steering holds for 200 ms (PUSH 0xc8).
export const YAW_RATE_DURATION = 200

// The wheel paired with each wheel for 0x00440cb0, from the table at 0x004b0d40.
const OPPOSITE_WHEELS = Object.freeze([3, 2, 1, 0])

const getRow = (body: CarRigidBody, row: 0 | 1 | 2): Vector3 => {
  const { rotation } = body.frame
  return Object.freeze({
    x: rotation[row * 3] ?? 0,
    y: rotation[row * 3 + 1] ?? 0,
    z: rotation[row * 3 + 2] ?? 0,
  })
}

export const getRotationRow = getRow

// 0x00445c30 (thiscall: rate, milliseconds): yaw timer = milliseconds, the angular momentum about
// rotation row 2 is replaced by the momentum that turns the body about row 2 at the rate.
export const setYawRate = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  rate: number,
  milliseconds: number
): CarRigidBody => {
  const up = getRow(body, 2)
  const withoutYaw = removeAngularMomentumAlongAxis(
    arithmetic,
    Object.freeze({ ...body, yawTimer: milliseconds }),
    up
  )
  return addAngularVelocity(arithmetic, withoutYaw, getStoredScaledVector(arithmetic, up, rate))
}

// 0x00448990 and 0x004489c0: the four values summed on the FPU stack from 0, times 0.25.
const getWheelAverage = (
  arithmetic: FloatArithmetic,
  wheels: readonly CarWheel[],
  getValue: (wheel: CarWheel) => number
): number =>
  arithmetic.multiply(
    wheels.reduce((sum, wheel) => arithmetic.add(sum, getValue(wheel)), 0),
    WHEEL_AVERAGE
  )

// 0x00448070: ends a drift (the drift sound object +0x6e8 is released there too, not modelled).
export const endDrift = (body: CarRigidBody): CarRigidBody =>
  Object.freeze({
    ...body,
    driftThreshold: -1,
    driftMaximumAngle: getFloatFromBits(0x40490fdb),
    flags: body.flags & ~(CarRigidBodyFlag.DRIFTING | CarRigidBodyFlag.DRIFT_SOUND),
  })

const getHasFlag = (body: CarRigidBody, flag: number): boolean => (body.flags & flag) !== 0

export const getIsFlagSet = getHasFlag

// The airborne branch of 0x00445500: four times gravity, and the throttle along the heading,
// never pushing up harder than gravity pulls down.
const getAirborneForces = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const { multiply, storeFloat, divide, getIsEqual, getIsBelowOrEqual } = arithmetic
  const falling = addForce(arithmetic, body, {
    x: 0,
    y: 0,
    z: storeFloat(multiply(body.weight, AIRBORNE_GRAVITY_FACTOR)),
  })
  const thrust = getStoredScaledVector(
    arithmetic,
    body.heading,
    multiply(body.throttle, body.scaledMass)
  )
  const lift = -body.weight
  const pushed = addForce(arithmetic, falling, {
    ...thrust,
    z: getIsBelowOrEqual(thrust.z, lift) ? thrust.z : lift,
  })
  if (getIsEqual(pushed.turnRadius, 0) || getHasFlag(pushed, CarRigidBodyFlag.WALL_TURN)) {
    return pushed
  }
  return setYawRate(
    arithmetic,
    pushed,
    storeFloat(divide(pushed.forwardSpeed, pushed.turnRadius)),
    YAW_RATE_DURATION
  )
}

// 0x00445500's wheel loop without flag 0x8: grounded wheels push with their share of the weight
// (only while fewer than three are down) and stop the body rolling over the opposite wheel.
const getWheelTorques = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  if (body.rollTimer !== 0 || body.pitchTimer !== 0) return body
  return body.wheels.reduce((current, wheel, index) => {
    if (!wheel.isOnGround) return current
    const pushed =
      current.groundedWheelCount < 3
        ? addTorqueOfForceAtPoint(arithmetic, current, wheel.groundForce, wheel.anchor)
        : current
    const opposite = pushed.wheels[OPPOSITE_WHEELS[index] ?? 0]
    return removeAngularMomentumAgainstForce(
      arithmetic,
      pushed,
      pushed.groundNormal,
      opposite?.anchor ?? pushed.groundNormal
    )
  }, body)
}

// The yaw rate of 0x00445500's turning branch (0x004459a0..0x00445a2c).
const getTurnYawRate = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  driftAlignment: number
): TurnYawRate => {
  const { divide, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  if (getHasFlag(body, CarRigidBodyFlag.DRIFTING)) {
    if (getIsBelow(driftAlignment, body.driftThreshold)) return { body, yawRate: 0 }
    const rate = divide(body.forwardSpeed, body.turnRadius)
    return {
      body: Object.freeze({ ...body, yawRate: storeFloat(rate) }),
      yawRate: storeFloat(multiply(body.driftYawFactor, rate)),
    }
  }
  const isCreeping =
    getIsBelow(body.forwardSpeed, MINIMUM_TURN_SPEED) &&
    !getIsBelowOrEqual(body.forwardSpeed, CREEP_SPEED)
  const rate = divide(isCreeping ? MINIMUM_TURN_SPEED : body.forwardSpeed, body.turnRadius)
  return { body: Object.freeze({ ...body, yawRate: storeFloat(rate) }), yawRate: storeFloat(rate) }
}

// The grounded steering of 0x00445500 (flags 0x2 and 0x800 clear): side friction, throttle or
// rolling friction, the centripetal force and the yaw rate.
const getSteeringForces = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  frictionFactor: number,
  driftAlignment: number
): CarRigidBody => {
  const { multiply, divide, storeFloat, getIsEqual } = arithmetic
  const gripped = addForce(
    arithmetic,
    body,
    getStoredScaledVector(
      arithmetic,
      body.lateralVelocity,
      multiply(multiply(body.mass, SIDE_FRICTION), frictionFactor)
    )
  )
  const isAlongRow0 =
    gripped.groundedWheelCount >= 3 && !getHasFlag(gripped, CarRigidBodyFlag.DRIFTING)
  const driving = getIsEqual(gripped.throttle, 0)
    ? getStoredScaledVector(
        arithmetic,
        gripped.forwardVelocity,
        multiply(gripped.mass, ROLLING_FRICTION)
      )
    : getStoredScaledVector(
        arithmetic,
        isAlongRow0 ? getRow(gripped, 0) : gripped.heading,
        multiply(gripped.throttle, gripped.scaledMass)
      )
  const driven = addForce(arithmetic, gripped, driving)
  if (getIsEqual(driven.turnRadius, 0)) return driven
  const inward = getNormalizedVector3(arithmetic, {
    x: -driven.heading.y,
    y: driven.heading.x,
    z: 0,
  })
  const centripetal = divide(
    multiply(multiply(driven.mass, driven.forwardSpeed), driven.forwardSpeed),
    driven.turnRadius
  )
  const turned = addForce(
    arithmetic,
    Object.freeze({ ...driven, centripetalForce: storeFloat(centripetal) }),
    getStoredScaledVector(arithmetic, inward, centripetal)
  )
  const turn = getTurnYawRate(arithmetic, turned, driftAlignment)
  return setYawRate(arithmetic, turn.body, turn.yawRate, YAW_RATE_DURATION)
}

// The grounded branch of 0x00445500.
const getGroundedForces = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  driftAlignment: number
): CarRigidBody => {
  const { add, multiply, subtract, getSquareRoot, storeFloat, getIsBelow } = arithmetic
  const averageGrip = storeFloat(
    getWheelAverage(arithmetic, body.wheels, (wheel) => wheel.surfaceGrip)
  )
  const averageSkidGrip = storeFloat(
    getWheelAverage(arithmetic, body.wheels, (wheel) => wheel.surfaceSkidGrip)
  )
  const { slopeForce } = body
  const slope = getSquareRoot(
    add(
      add(multiply(slopeForce.z, slopeForce.z), multiply(slopeForce.y, slopeForce.y)),
      multiply(slopeForce.x, slopeForce.x)
    )
  )
  const holding = multiply(multiply(body.gravity, body.scaledMass), averageGrip)
  const sliding = getIsBelow(holding, slope) ? addForce(arithmetic, body, slopeForce) : body
  if (getHasFlag(sliding, CarRigidBodyFlag.TWO_POINT))
    throw new TwoPointModeNotPortedError(0x004456c8)
  const steadied = getWheelTorques(arithmetic, sliding)
  const isBraking = getHasFlag(steadied, CarRigidBodyFlag.DRIFTING | CarRigidBodyFlag.SPINNING)
  const braked = isBraking
    ? addForce(
        arithmetic,
        steadied,
        getStoredScaledVector(
          arithmetic,
          steadied.velocityDirection,
          -multiply(
            multiply(multiply(steadied.gravity, steadied.scaledMass), averageSkidGrip),
            steadied.driftBrake
          )
        )
      )
    : steadied
  const frictionFactor = isBraking ? subtract(1, braked.driftBrake) : 1
  if (getHasFlag(braked, CarRigidBodyFlag.SPINNING | CarRigidBodyFlag.WALL_TURN)) {
    return addForce(
      arithmetic,
      braked,
      getStoredScaledVector(
        arithmetic,
        braked.lateralVelocity,
        multiply(multiply(braked.mass, SPIN_SIDE_FRICTION), frictionFactor)
      )
    )
  }
  return getSteeringForces(arithmetic, braked, frictionFactor, driftAlignment)
}

// The surface forces (+0x64..+0x6c of each wheel), skipped with flags 0x8 or 0x80.
const getSurfaceForce = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const { add, multiply, storeFloat } = arithmetic
  const sum = body.wheels.reduce(
    (total, wheel) => ({
      x: add(total.x, wheel.surfaceForce.x),
      y: add(total.y, wheel.surfaceForce.y),
      z: add(total.z, wheel.surfaceForce.z),
    }),
    { x: 0, y: 0, z: 0 }
  )
  const unroundedScale = multiply(body.scaledMass, WHEEL_AVERAGE)
  const scale = storeFloat(unroundedScale)
  return addForce(arithmetic, body, {
    x: storeFloat(multiply(unroundedScale, sum.x)),
    y: storeFloat(multiply(sum.y, scale)),
    z: storeFloat(multiply(sum.z, scale)),
  })
}

// 0x00445500 (thiscall): the forces of one pass. Ends a drift whose heading turned away from the
// velocity, then applies gravity, grip, steering, surface forces, drag and the extra forces.
export const applyCarForces = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const { add, multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  const start = Object.freeze({
    ...body,
    weight: storeFloat(multiply(-body.gravity, body.scaledMass)),
    yawRate: 0,
  })
  const row0 = getRow(start, 0)
  const driftAlignment = getHasFlag(start, CarRigidBodyFlag.DRIFTING)
    ? storeFloat(
        add(
          add(
            multiply(start.velocityDirection.z, row0.z),
            multiply(start.velocityDirection.y, row0.y)
          ),
          multiply(row0.x, start.velocityDirection.x)
        )
      )
    : 0
  const checked =
    getHasFlag(start, CarRigidBodyFlag.DRIFTING) && getIsBelowOrEqual(driftAlignment, 0)
      ? endDrift(start)
      : start
  const moved =
    checked.groundedWheelCount === 0
      ? getAirborneForces(arithmetic, checked)
      : getGroundedForces(arithmetic, checked, driftAlignment)
  const pushed = getHasFlag(moved, CarRigidBodyFlag.TWO_POINT | CarRigidBodyFlag.FLAGGED)
    ? moved
    : getSurfaceForce(arithmetic, moved)
  const surfaceDrag = getHasFlag(pushed, CarRigidBodyFlag.TWO_POINT)
    ? 0
    : getWheelAverage(arithmetic, pushed.wheels, (wheel) => wheel.surfaceDrag)
  const dragged = addForce(
    arithmetic,
    pushed,
    getStoredScaledVector(
      arithmetic,
      pushed.linearVelocity,
      -multiply(add(surfaceDrag, pushed.drag), pushed.speed)
    )
  )
  const withForceA = getHasFlag(dragged, CarRigidBodyFlag.EXTRA_FORCE_A)
    ? addForce(arithmetic, dragged, dragged.extraForceA)
    : dragged
  return getHasFlag(withForceA, CarRigidBodyFlag.EXTRA_FORCE_B)
    ? addForce(arithmetic, withForceA, withForceA.extraForceB)
    : withForceA
}

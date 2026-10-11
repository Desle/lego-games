import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import {
  createRouteFollower,
  getPushedSpeedState,
  getRestoredSpeedState,
  moveRouteFollower,
  setRouteFollowerSpeedFactor,
  startRouteFollowerAtLoop,
} from '../../../racer-ai/index.ts'
import type { ComputerSpeedState } from '../../../racer-ai/index.ts'
import {
  addScaledImpulse,
  CarRigidBodyFlag,
  setExtraForce,
  startSpin,
} from '../../../racer-physics/index.ts'
import {
  getFloatFromBits,
  getFrameTransformedPoint,
  getMatrixFromQuaternion,
  getTruncatedInteger,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { CarBody, CarBodyPushSlot } from '../racer.types.ts'

const TURN = getFloatFromBits(0x40c90fdb) // 0x004b02f8, 2π
const SPIN_SPEED_FACTOR = getFloatFromBits(0x3e99999a) // 0x004b0490, 0.3
const SPIN_SPEED_MARGIN = getFloatFromBits(0x3dcccccd) // 0x004b0540, 0.1
const IMPULSE_LIMIT = getFloatFromBits(0x43700000) // 0x004b04b4, 240
const FORWARD_RATE = getFloatFromBits(0x3d4ccccd) // 0x004b0544, 0.05
const BACKWARD_RATE = getFloatFromBits(0x3e800000) // 0x004b053c, 0.25
const MAXIMUM_SPEED_FACTOR = getFloatFromBits(0x40300000) // 0x004b04a0, 2.75
const MINIMUM_SPEED_FACTOR = getFloatFromBits(0xbf000000) // 0x004b04a4, -0.5

const getAlongHeading = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  direction: Vector3
): number => {
  const { add, multiply } = arithmetic
  const { heading } = body.rigidBody
  return add(
    add(multiply(heading.z, direction.z), multiply(heading.y, direction.y)),
    multiply(heading.x, direction.x)
  )
}

const getIsSpinning = (body: CarBody): boolean =>
  (body.rigidBody.flags & CarRigidBodyFlag.SPINNING) !== 0

// Car body slot 8 (0x00429770, thiscall: direction, amount). A free body takes the car rigid body's
// 0x00448110. A scripted body has no velocity: the impulse along its heading (at most 240) moves
// the route speed factor, up by 0.05 per unit of the cosine's complement when pushed forward and down by
// 0.25 per unit when pushed back, clamped to [-0.5, 2.75].
export const addCarBodyImpulse = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  direction: Vector3,
  amount: number
): CarBody => {
  if (!body.isScripted) {
    return Object.freeze({
      ...body,
      rigidBody: addScaledImpulse(arithmetic, body.rigidBody, direction, amount),
    })
  }
  const { add, subtract, multiply, divide, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const along = getAlongHeading(arithmetic, body, direction)
  const isReversed = getIsBelow(amount, 0)
  const signedAlong = isReversed ? -along : along
  const magnitude = isReversed ? -amount : amount
  const limited = getIsBelowOrEqual(magnitude, IMPULSE_LIMIT) ? magnitude : IMPULSE_LIMIT
  const fraction = storeFloat(divide(limited, IMPULSE_LIMIT))
  const isSpinning = getIsSpinning(body)
  if (!getIsBelow(signedAlong, 0)) {
    const rate = multiply(subtract(1, signedAlong), FORWARD_RATE)
    const base = isSpinning
      ? add(SPIN_SPEED_FACTOR, SPIN_SPEED_MARGIN)
      : add(body.speedFactor, fraction)
    const factor = add(rate, base)
    return Object.freeze({
      ...body,
      speedFactor: getIsBelowOrEqual(factor, MAXIMUM_SPEED_FACTOR)
        ? storeFloat(factor)
        : MAXIMUM_SPEED_FACTOR,
    })
  }
  const rate = multiply(add(signedAlong, 1), BACKWARD_RATE)
  const base = isSpinning
    ? subtract(SPIN_SPEED_FACTOR, SPIN_SPEED_MARGIN)
    : subtract(body.speedFactor, fraction)
  const factor = subtract(base, rate)
  return Object.freeze({
    ...body,
    speedFactor: getIsBelow(factor, MINIMUM_SPEED_FACTOR)
      ? MINIMUM_SPEED_FACTOR
      : storeFloat(factor),
  })
}

// Car body slot 9 (0x00429c40, thiscall: factor, rate, spin time). A free body takes 0x00448160. A
// scripted body that is not spinning gets a yaw timer of `_ftol(factor · 2π / rate)`, remembers the rate
// and starts the spin with the route speed factor at 0.3 when a wheel is on the ground.
export const startCarBodySpin = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  factor: number,
  rate: number,
  spinTime: number
): CarBody => {
  if (!body.isScripted) {
    return Object.freeze({
      ...body,
      rigidBody: startSpin(arithmetic, body.rigidBody, factor, rate, spinTime),
    })
  }
  if (getIsSpinning(body)) return body
  const rigidBody = Object.freeze({
    ...body.rigidBody,
    yawTimer: getTruncatedInteger(arithmetic.divide(arithmetic.multiply(factor, TURN), rate)),
    flags: body.rigidBody.flags | CarRigidBodyFlag.SPINNING,
  })
  return Object.freeze({
    ...body,
    rigidBody,
    scriptedSpinPeriod: rate,
    scriptedSpinTime: 0,
    speedFactor: body.rigidBody.groundedWheelCount === 0 ? body.speedFactor : SPIN_SPEED_FACTOR,
  })
}

// 0x00429990 and 0x00429940 through racer-ai: the scripted body's target speed factor follows the push or goes back.
const getWithSpeedState = (body: CarBody, state: ComputerSpeedState): CarBody =>
  Object.freeze({
    ...body,
    rigidBody: Object.freeze({ ...body.rigidBody, flags: state.flags }),
    targetSpeedFactor: state.targetSpeedFactor,
    defaultTargetSpeedFactor: state.defaultTargetSpeedFactor,
  })

const getSpeedState = (body: CarBody): ComputerSpeedState =>
  Object.freeze({
    flags: body.rigidBody.flags,
    speedFactor: body.speedFactor,
    targetSpeedFactor: body.targetSpeedFactor,
    defaultTargetSpeedFactor: body.defaultTargetSpeedFactor,
  })

// Car body slots 16 and 18 (0x004298a0, 0x004298f0, thiscall: force) and 17 and 19 (0x004298d0,
// 0x00429920): a force added every pass (free body) or a push on the target speed factor (scripted).
export const setCarBodyPush = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  slot: CarBodyPushSlot,
  force: Vector3 | undefined
): CarBody => {
  if (body.isScripted) {
    return getWithSpeedState(
      body,
      force === undefined
        ? getRestoredSpeedState(arithmetic, getSpeedState(body))
        : getPushedSpeedState(arithmetic, getSpeedState(body), body.rigidBody.heading, force)
    )
  }
  return Object.freeze({
    ...body,
    rigidBody: setExtraForce(arithmetic, body.rigidBody, slot, force),
  })
}

// 0x0042a730 (thiscall: route): the car body follows the route from its loop point. The follower restarts there,
// and the display frame takes the loop position and rotation, with the centre of mass and the hull points
// moved with it (frame slots +8, +0x2c).
export const placeCarBodyAtRouteLoop = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  route: ComputerRacerRoute
): CarBody => {
  const [x, y, z] = route.secondVector
  const [quaternionX, quaternionY, quaternionZ, quaternionW] = route.secondQuaternion
  const displayFrame = Object.freeze({
    rotation: getMatrixFromQuaternion(arithmetic, {
      x: quaternionX,
      y: quaternionY,
      z: quaternionZ,
      w: quaternionW,
    }),
    position: Object.freeze({ x, y, z }),
  })
  const getWorldPoint = (point: Vector3): Vector3 =>
    getFrameTransformedPoint(arithmetic, displayFrame, point)
  const { rigidBody } = body
  return Object.freeze({
    ...body,
    isScripted: true,
    routeFollower: startRouteFollowerAtLoop(
      arithmetic,
      body.routeFollower ?? createRouteFollower(route, body.speedFactor),
      route
    ),
    rigidBody: Object.freeze({
      ...rigidBody,
      displayFrame,
      worldCentreOfMass: getWorldPoint(rigidBody.localCentreOfMass),
      worldHullPoints: Object.freeze(rigidBody.localHullPoints.map(getWorldPoint)),
    }),
  })
}

// 0x0042b0c0: the route speed factor and targets return to 1, the follower settles on its segment
// (0x004a5750 with no displacement) and the sideways offset and bounce return to 0. +0x7c4 is not modelled.
export const resetCarBodyRoute = (arithmetic: FloatArithmetic, body: CarBody): CarBody =>
  Object.freeze({
    ...body,
    speedFactor: 1,
    routeFollower:
      body.routeFollower === null
        ? null
        : moveRouteFollower(
            arithmetic,
            setRouteFollowerSpeedFactor(body.routeFollower, 1),
            ZERO_VECTOR3
          ).follower,
    defaultTargetSpeedFactor: 1,
    bounceHeight: 0,
    lateralOffset: 0,
    bounceVerticalSpeed: 0,
    targetSpeedFactor: 1,
  })

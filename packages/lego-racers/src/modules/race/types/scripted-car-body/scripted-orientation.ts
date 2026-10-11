import { advanceRouteFollower } from '../../../racer-ai/index.ts'
import { CarRigidBodyFlag } from '../../../racer-physics/index.ts'
import type { CarRigidBody } from '../../../racer-physics/index.ts'
import type { CarBody } from '../../../racer/index.ts'
import {
  getDotProduct,
  getFloatFromBits,
  getFrameAxes,
  getFrameTransformedPoint,
  getMatrixFromQuaternion,
  getRotationFromFrameAxes,
  getVectorRotatedAroundAxis,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Matrix3, Vector3 } from '../../../simulation-math/index.ts'

const THOUSANDTH = getFloatFromBits(0x3a83126f) // 0x004af220
const TILT_RATE = getFloatFromBits(0x3ba3d70a) // 0x004b0d28, 0.005 per millisecond
const MAXIMUM_TILT = getFloatFromBits(0x3f490fdb) // 0x004b0480, a quarter turn halved
const TILT_SCALE = getFloatFromBits(0x41000000) // 0x004b0098, 8
const FLIP_DAMPING = getFloatFromBits(0x3e800000) // 0x004b053c, 0.25
const LOOK_AHEAD_MILLISECONDS = 500 // 0x43fa0000
const SPINNING_AND_STARTED_FLAGS = CarRigidBodyFlag.SPINNING | CarRigidBodyFlag.SPIN_STARTED

const getRow = (rotation: Matrix3, row: 0 | 1 | 2): Vector3 =>
  Object.freeze({
    x: rotation[row * 3] ?? 0,
    y: rotation[row * 3 + 1] ?? 0,
    z: rotation[row * 3 + 2] ?? 0,
  })

const getBodyWithRotation = (carBody: CarBody, rotation: Matrix3): CarBody =>
  Object.freeze({
    ...carBody,
    rigidBody: Object.freeze({
      ...carBody.rigidBody,
      displayFrame: Object.freeze({ ...carBody.rigidBody.displayFrame, rotation }),
    }),
  })

// 0x0042a100 (flag 0x8, once per call of 0x00429d40): the tilt the body leans to is the dot product of the
// orientation the route has 500 ms from now (its row 0) with the current row 1, times 8, held to [-1, 1] and
// scaled by a quarter turn halved. The follower is copied, not moved.
export const getScriptedBodyWithTargetTilt = (
  arithmetic: FloatArithmetic,
  carBody: CarBody
): CarBody => {
  const follower = carBody.routeFollower
  if (follower === null) return carBody
  const { multiply, storeFloat, getIsBelowOrEqual, getIsBelow } = arithmetic
  const current = getMatrixFromQuaternion(arithmetic, follower.rotation)
  const ahead = getMatrixFromQuaternion(
    arithmetic,
    advanceRouteFollower(arithmetic, follower, LOOK_AHEAD_MILLISECONDS).rotation
  )
  const left = getRow(current, 1)
  const forward = getRow(ahead, 0)
  const scaled = multiply(getDotProduct(arithmetic, forward, left), TILT_SCALE)
  const limited = !getIsBelowOrEqual(scaled, 1) ? 1 : getIsBelow(scaled, -1) ? -1 : scaled
  return Object.freeze({
    ...carBody,
    rigidBody: Object.freeze({
      ...carBody.rigidBody,
      twoPointTargetTilt: storeFloat(multiply(MAXIMUM_TILT, limited)),
    }),
  })
}

// 0x004464a0 (thiscall: step): the two-point height and tilt move toward their targets, by rate · step · 0.001 and
// by step · 0.005, and stop there.
export const getBodyWithTwoPointOffsets = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const heightChange = multiply(multiply(body.twoPointHeightRate, stepMilliseconds), THOUSANDTH)
  let height = body.twoPointHeight
  if (getIsBelow(height, body.twoPointTargetHeight)) {
    height = storeFloat(add(heightChange, height))
    if (!getIsBelowOrEqual(height, body.twoPointTargetHeight)) height = body.twoPointTargetHeight
  } else if (!getIsBelowOrEqual(height, body.twoPointTargetHeight)) {
    height = storeFloat(subtract(height, heightChange))
    if (getIsBelow(height, body.twoPointTargetHeight)) height = body.twoPointTargetHeight
  }
  const tiltChange = multiply(stepMilliseconds, TILT_RATE)
  let tilt = body.twoPointTilt
  if (getIsBelow(tilt, body.twoPointTargetTilt)) {
    tilt = storeFloat(add(tiltChange, tilt))
    if (!getIsBelowOrEqual(tilt, body.twoPointTargetTilt)) tilt = body.twoPointTargetTilt
  } else if (!getIsBelowOrEqual(tilt, body.twoPointTargetTilt)) {
    tilt = storeFloat(subtract(tilt, tiltChange))
    if (getIsBelow(tilt, body.twoPointTargetTilt)) tilt = body.twoPointTargetTilt
  }
  return Object.freeze({ ...body, twoPointHeight: height, twoPointTilt: tilt })
}

// 0x0042a290, the flip part (pitch timer +0x5dc, rate +0x7dc, angle +0x7e0, height +0x7e4): the angle moves by
// rate · step; when the timer runs out the rate reverses at a quarter of its size, and the flip ends where the angle
// crosses 0. While it runs, row 0 turns about row 1 and the lift of wheel 1 is measured.
const getBodyAfterFlip = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  stepMilliseconds: number
): CarBody => {
  const { rigidBody } = carBody
  const { add, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  const timer = rigidBody.pitchTimer
  if (timer === 0 && carBody.flipAngle === 0) return carBody
  const isTimeUp = timer !== 0 && stepMilliseconds >= timer
  const rate = isTimeUp ? -multiply(carBody.flipRate, FLIP_DAMPING) : carBody.flipRate
  const nextTimer = timer === 0 ? 0 : isTimeUp ? 0 : timer - stepMilliseconds
  const isNonNegativeBefore = !getIsBelow(carBody.flipAngle, 0)
  const sum = add(multiply(rate, stepMilliseconds), carBody.flipAngle)
  const angle = storeFloat(sum)
  const turned: CarBody = Object.freeze({
    ...carBody,
    flipRate: isTimeUp ? storeFloat(rate) : carBody.flipRate,
    flipAngle: angle,
    rigidBody: Object.freeze({ ...rigidBody, pitchTimer: nextTimer }),
  })
  if (nextTimer === 0 && isNonNegativeBefore !== !getIsBelow(sum, 0)) {
    return Object.freeze({ ...turned, flipAngle: 0, flipHeight: 0 })
  }
  const { displayFrame } = rigidBody
  const rows = [
    getRow(displayFrame.rotation, 0),
    getRow(displayFrame.rotation, 1),
    getRow(displayFrame.rotation, 2),
  ]
  const anchor = getFrameTransformedPoint(arithmetic, displayFrame, rigidBody.localWheelAnchor)
  const first = getVectorRotatedAroundAxis(arithmetic, rows[0] ?? anchor, rows[1] ?? anchor, angle)
  const rotation = getRotationFromFrameAxes(arithmetic, { first, third: rows[2] ?? anchor })
  const rotatedFrame = Object.freeze({ ...displayFrame, rotation })
  const lifted = getFrameTransformedPoint(arithmetic, rotatedFrame, rigidBody.localWheelAnchor)
  return Object.freeze({
    ...turned,
    flipHeight: storeFloat(subtract(lifted.z, anchor.z)),
    rigidBody: Object.freeze({
      ...turned.rigidBody,
      displayFrame: rotatedFrame,
      wheels: Object.freeze(
        turned.rigidBody.wheels.map((wheel, wheelIndex) =>
          wheelIndex === 1 ? Object.freeze({ ...wheel, anchor }) : wheel
        )
      ),
    }),
  })
}

// 0x0042a290, the spin part (yaw timer +0x5e0, rate +0x7d4, angle +0x7d8): row 0 turns about row 2 by rate · step more
// each call; when the timer runs out the spin ends (car body 0x00429cd0 for a scripted body clears flags 0x2 and 0x4).
const getBodyAfterSpin = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  stepMilliseconds: number
): CarBody => {
  const { rigidBody } = carBody
  const timer = rigidBody.yawTimer
  if (timer === 0) return carBody
  if (stepMilliseconds >= timer) {
    return Object.freeze({
      ...carBody,
      rigidBody: Object.freeze({
        ...rigidBody,
        yawTimer: 0,
        flags: rigidBody.flags & ~SPINNING_AND_STARTED_FLAGS,
      }),
    })
  }
  const { add, multiply, storeFloat } = arithmetic
  const { displayFrame } = rigidBody
  const axes = getFrameAxes(displayFrame.rotation)
  const angle = storeFloat(
    add(multiply(carBody.scriptedSpinPeriod, stepMilliseconds), carBody.scriptedSpinTime)
  )
  const first = getVectorRotatedAroundAxis(arithmetic, axes.first, axes.third, angle)
  return Object.freeze({
    ...carBody,
    scriptedSpinTime: angle,
    rigidBody: Object.freeze({
      ...rigidBody,
      yawTimer: timer - stepMilliseconds,
      displayFrame: Object.freeze({
        ...displayFrame,
        rotation: getRotationFromFrameAxes(arithmetic, { first, third: axes.third }),
      }),
    }),
  })
}

// 0x0042a290 (thiscall: step): the display frame takes the route's orientation, leans by the two-point tilt, turns
// with the flip and with the spin.
export const getScriptedBodyOriented = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  stepMilliseconds: number
): CarBody => {
  const { routeFollower } = carBody
  if (routeFollower === null) return carBody
  const { rigidBody } = carBody
  const routed = getBodyWithRotation(
    carBody,
    getMatrixFromQuaternion(arithmetic, routeFollower.rotation)
  )
  const isTilted =
    (rigidBody.flags & CarRigidBodyFlag.TWO_POINT) !== 0 ||
    !arithmetic.getIsEqual(rigidBody.twoPointTilt, 0)
  const tilted = isTilted ? getBodyWithTilt(arithmetic, routed) : routed
  return getBodyAfterSpin(
    arithmetic,
    getBodyAfterFlip(arithmetic, tilted, stepMilliseconds),
    stepMilliseconds
  )
}

const getBodyWithTilt = (arithmetic: FloatArithmetic, carBody: CarBody): CarBody => {
  const { displayFrame, twoPointTilt } = carBody.rigidBody
  const axes = getFrameAxes(displayFrame.rotation)
  const third = getVectorRotatedAroundAxis(
    arithmetic,
    getRow(displayFrame.rotation, 2),
    axes.first,
    twoPointTilt
  )
  return getBodyWithRotation(
    carBody,
    getRotationFromFrameAxes(arithmetic, { first: axes.first, third })
  )
}

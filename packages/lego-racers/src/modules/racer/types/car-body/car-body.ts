import {
  CarRigidBodyFlag,
  endDrift,
  setLeaning,
  setThrottle,
} from '../../../racer-physics/index.ts'
import type { CarRigidBody } from '../../../racer-physics/index.ts'
import {
  getMatrixFromQuaternion,
  getQuaternionFromMatrix,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getTableCosine } from '../cosine-table/cosine-table.ts'
import type { CarBody, CarBodyDefinition, RacerTables } from '../racer.types.ts'

// float32 constants of the car rigid body.
const MINIMUM_STEERING = Math.fround(40) // 0x004b0cd0
const MAXIMUM_STEERING = Math.fround(4096) // 0x004b0cd4
const AIRBORNE_MAXIMUM_CURVATURE = Math.fround(100) // 0x004b0d88
const SLIDE_PHASE_SCALE = Math.fround(162.9746551513672) // 0x004b0b48, 1024 / 2π
const SLIDE_ALIGNMENT = Math.fround(0.9) // 0x004b0554
const SLIDE_MAXIMUM_SPEED = Math.fround(0.155) // 0x004b0470
const POWER_SLIDE_ALIGNMENT = Math.fround(0.85) // 0x004b0550
const POWER_SLIDE_MINIMUM_FORWARD_SPEED = Math.fround(0.05) // 0x004b046c

const UNIT_QUATERNION_ZERO = Object.freeze({ x: 0, y: 0, z: 0, w: 0 })

// Fields 0x00429120 resets around the car rigid body that the attach (0x00429210, 0x00444d90) set up.
export const createCarBody = (definition: CarBodyDefinition): CarBody =>
  Object.freeze({
    rigidBody: definition.rigidBody,
    fadeFactor: 1,
    safePosition: ZERO_VECTOR3,
    safeOrientation: UNIT_QUATERNION_ZERO,
    steeringScale: definition.steeringScale,
    throttleScale: definition.throttleScale,
    isScripted: false,
    // The route follower's constructor 0x004a5190 sets +0x2c (car body +0x778) to 1.0.
    speedFactor: 1,
    defaultTargetSpeedFactor: 1,
    targetSpeedFactor: 1,
    routeFollower: null,
    isRouteHeld: false,
    rampMilliseconds: 0,
    lateralOffset: 0,
    bounceHeight: 0,
    bounceVerticalSpeed: 0,
  })

const setRigidBody = (body: CarBody, rigidBody: CarRigidBody): CarBody =>
  Object.freeze({ ...body, rigidBody })

const getHasFlag = (body: CarBody, flag: number): boolean => (body.rigidBody.flags & flag) !== 0

const getClampedSteering = (arithmetic: FloatArithmetic, steering: number): number => {
  const { getIsBelow, getIsBelowOrEqual } = arithmetic
  if (!getIsBelowOrEqual(steering, 0)) {
    if (getIsBelow(steering, MINIMUM_STEERING)) return MINIMUM_STEERING
    return getIsBelowOrEqual(steering, MAXIMUM_STEERING) ? steering : 0
  }
  if (!getIsBelow(steering, 0)) return 0
  if (!getIsBelowOrEqual(steering, -MINIMUM_STEERING)) return -MINIMUM_STEERING
  return getIsBelowOrEqual(-MAXIMUM_STEERING, steering) ? steering : 0
}

// 0x00446ef0: the turn radius (car rigid body +0x64c); |radius| below 40 becomes ±40, above 4096 becomes 0.
export const setCarBodySteering = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  steering: number
): CarBody =>
  setRigidBody(
    body,
    Object.freeze({ ...body.rigidBody, turnRadius: getClampedSteering(arithmetic, steering) })
  )

// 0x00447f30 (thiscall: yaw factor, brake, maximum angle): starts a drift (flag 0x1). The drift
// threshold +0x6c8 is the cosine of the maximum angle. The skid sound (0x00443bd0, sound 0x3a) is not modelled.
export const startCarBodySlide = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  body: CarBody,
  strength: number,
  damping: number,
  rate: number
): CarBody =>
  setRigidBody(
    body,
    Object.freeze({
      ...body.rigidBody,
      driftYawFactor: strength,
      driftBrake: damping,
      flags: body.rigidBody.flags | CarRigidBodyFlag.DRIFTING,
      driftMaximumAngle: rate,
      // _ftol truncates toward zero; the index is then masked with 0x3ff.
      driftThreshold: getTableCosine(
        tables,
        Math.trunc(arithmetic.multiply(rate, SLIDE_PHASE_SCALE))
      ),
    })
  )

// 0x00448070, racer-physics' endDrift. The skid sound (+0x6e8) is not modelled.
export const stopCarBodySlide = (body: CarBody): CarBody =>
  setRigidBody(body, endDrift(body.rigidBody))

// 0x00449070, racer-physics' setLeaning.
export const startCarBodyPowerSlide = (body: CarBody, factor: number): CarBody =>
  setRigidBody(body, setLeaning(body.rigidBody, factor))

// 0x00449090.
export const stopCarBodyPowerSlide = (body: CarBody): CarBody =>
  setRigidBody(body, setLeaning(body.rigidBody, undefined))

// 0x004489f0: average grip (+0x5c) of the grounded wheels times +0x5f4; 0 when none touches. The result stays on the FPU stack.
export const getCarBodyAverageGrip = (arithmetic: FloatArithmetic, body: CarBody): number => {
  const touching = body.rigidBody.wheels.filter((wheel) => wheel.isOnGround)
  if (touching.length === 0) return 0
  const sum = touching.reduce((total, wheel) => arithmetic.add(total, wheel.grip), 0)
  return arithmetic.multiply(arithmetic.divide(sum, touching.length), body.rigidBody.gripScale)
}

// 0x00445cb0 (also through the thunk 0x0042ae10): forwardSpeed² · mass / (gravity · scaledMass · grip). Not stored.
export const getCarBodyMaximumCurvature = (arithmetic: FloatArithmetic, body: CarBody): number => {
  const { multiply, divide, getIsEqual } = arithmetic
  const { rigidBody } = body
  const support = multiply(
    multiply(rigidBody.gravity, rigidBody.scaledMass),
    getCarBodyAverageGrip(arithmetic, body)
  )
  if (getIsEqual(support, 0)) {
    return rigidBody.groundedWheelCount === 0 ? AIRBORNE_MAXIMUM_CURVATURE : MAXIMUM_STEERING
  }
  const speed = rigidBody.forwardSpeed
  return divide(multiply(multiply(speed, speed), rigidBody.mass), support)
}

// (t.z · r.z + t.y · r.y) + t.x · r.x with t the velocity direction (+0x5f8) and r the display
// frame's row 0; the order of 0x0042aea0 and 0x0042ae20.
const getTravelAlignment = (arithmetic: FloatArithmetic, body: CarBody): number => {
  const { add, multiply } = arithmetic
  const [rowX, rowY, rowZ] = body.rigidBody.displayFrame.rotation
  const { velocityDirection: direction } = body.rigidBody
  return add(
    add(multiply(direction.z, rowZ), multiply(direction.y, rowY)),
    multiply(direction.x, rowX)
  )
}

const getIsSteeringAgainst = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  curvature: number
): boolean => {
  const { getIsBelow, getIsBelowOrEqual } = arithmetic
  const { turnRadius } = body.rigidBody
  if (getIsBelow(curvature, 0) && !getIsBelowOrEqual(turnRadius, 0)) return true
  return !getIsBelowOrEqual(curvature, 0) && getIsBelow(turnRadius, 0)
}

// 0x0042aea0 (thiscall: curvature): whether the driver may start a slide.
export const getIsCarBodyAbleToSlide = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  curvature: number
): boolean => {
  const { storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const alignment = getTravelAlignment(arithmetic, body)
  if (getIsBelowOrEqual(alignment, 0)) return false
  if (getIsSteeringAgainst(arithmetic, body, curvature)) return false
  // FST keeps a float32 copy; this later test reads the copy.
  const isAligned = !getIsBelow(storeFloat(alignment), SLIDE_ALIGNMENT)
  if (!getHasFlag(body, CarRigidBodyFlag.DRIFTING) && !isAligned) return false
  if (body.rigidBody.contactCount !== 0) return false
  return getIsBelowOrEqual(body.rigidBody.speed, SLIDE_MAXIMUM_SPEED)
}

// 0x0042ae20: whether a power slide can start.
export const getIsCarBodyAbleToPowerSlide = (
  arithmetic: FloatArithmetic,
  body: CarBody
): boolean => {
  const { rigidBody } = body
  if (rigidBody.contactCount !== 0) return false
  if (!getHasFlag(body, CarRigidBodyFlag.TWO_POINT) && rigidBody.groundedWheelCount < 3)
    return false
  if (arithmetic.getIsBelowOrEqual(getTravelAlignment(arithmetic, body), POWER_SLIDE_ALIGNMENT)) {
    return false
  }
  return !arithmetic.getIsBelow(rigidBody.forwardSpeed, POWER_SLIDE_MINIMUM_FORWARD_SPEED)
}

// Car body slot 5, 0x0042ad30: 0x00448370(throttleScale · throttle), racer-physics' setThrottle.
export const setCarBodyThrottle = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  throttle: number
): CarBody => {
  const scaled = arithmetic.storeFloat(arithmetic.multiply(body.throttleScale, throttle))
  return setRigidBody(body, setThrottle(arithmetic, body.rigidBody, scaled))
}

// Car body slot 10, 0x00448290: the spin timer (+0x5e4) is reduced by whole periods (+0x5e8) and becomes the yaw timer (+0x5e0).
export const foldCarBodySpinTimer = (body: CarBody): CarBody => {
  const { rigidBody } = body
  const pending = rigidBody.spinTimer
  if (pending === 0) return body
  const period = rigidBody.spinPeriod
  if (pending > period && period === 0) {
    throw new Error('0x00448290 never ends with a zero period and a pending time')
  }
  const remainder = pending > period ? ((pending - 1) % period) + 1 : pending
  return setRigidBody(
    body,
    Object.freeze({ ...rigidBody, spinTimer: 0, yawTimer: remainder, spinPeriod: 0 })
  )
}

// CarBody_Update 0x004293f0, after RigidBody_Step: the last safe pose is saved with all four wheels down.
export const saveCarBodySafePose = (arithmetic: FloatArithmetic, body: CarBody): CarBody =>
  Object.freeze({
    ...body,
    safePosition: body.rigidBody.frame.position,
    safeOrientation: getQuaternionFromMatrix(arithmetic, body.rigidBody.frame.rotation),
  })

// CarBody_Update 0x004293f0: Frame_SetPosition(+0x700), Math_QuaternionToMatrix(+0x70c → +0x10c), v = L = 0.
export const restoreCarBodySafePose = (arithmetic: FloatArithmetic, body: CarBody): CarBody =>
  setRigidBody(
    body,
    Object.freeze({
      ...body.rigidBody,
      frame: Object.freeze({
        rotation: getMatrixFromQuaternion(arithmetic, body.safeOrientation),
        position: body.safePosition,
      }),
      linearVelocity: ZERO_VECTOR3,
      angularMomentum: ZERO_VECTOR3,
    })
  )

export const getCarBodyPosition = (body: CarBody): Vector3 => body.rigidBody.frame.position

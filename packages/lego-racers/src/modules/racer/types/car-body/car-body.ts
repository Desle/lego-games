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
const PI = Math.fround(Math.PI) // 0x40490fdb
const DEFAULT_POWER_SLIDE_FACTOR = Math.fround(0.2) // 0x004b0d80
const SLIDE_ALIGNMENT = Math.fround(0.9) // 0x004b0554
const SLIDE_MAXIMUM_SPEED = Math.fround(0.155) // 0x004b0470
const POWER_SLIDE_ALIGNMENT = Math.fround(0.85) // 0x004b0550
const POWER_SLIDE_MINIMUM_FORWARD_SPEED = Math.fround(0.05) // 0x004b046c

const SLIDING_FLAG = 0x1
const AIRBORNE_CONTROL_FLAG = 0x8
const POWER_SLIDE_FLAG = 0x400
const SLIDE_FLAGS = 0x201
const WHEEL_TOUCHING_FLAG = 0x1

const UNIT_QUATERNION_ZERO = Object.freeze({ x: 0, y: 0, z: 0, w: 0 })

// Fields 0x00429120 resets, plus the values the caller's attach (0x00429210, 0x00444d90) and RigidBody_Step provide.
export const createCarBody = (definition: CarBodyDefinition): CarBody =>
  Object.freeze({
    rigidBody: definition.rigidBody,
    fadeFactor: 1,
    displayFrame: definition.displayFrame,
    scaledMass: definition.scaledMass,
    gravity: definition.gravity,
    restingForward: ZERO_VECTOR3,
    wheels: Object.freeze(Array.from({ length: 4 }, () => Object.freeze({ flags: 0, grip: 0 }))),
    groundedWheelCount: 0,
    contact: 0,
    spinTimerMilliseconds: 0,
    pendingSpinMilliseconds: 0,
    spinPeriodMilliseconds: 0,
    driveFactor: 0,
    gripScale: definition.gripScale,
    travelDirection: ZERO_VECTOR3,
    speed: 0,
    wheelRadius: definition.wheelRadius,
    forwardSpeed: 0,
    throttle: 0,
    steering: 0,
    flags: 0,
    slideStrength: 0,
    slideCosine: -1,
    slideRate: PI,
    slideDamping: 0,
    powerSlideFactor: DEFAULT_POWER_SLIDE_FACTOR,
    safePosition: ZERO_VECTOR3,
    safeOrientation: UNIT_QUATERNION_ZERO,
    steeringScale: definition.steeringScale,
    throttleScale: definition.throttleScale,
    isScripted: false,
    speedFactor: 0,
    defaultTargetSpeedFactor: 1,
    targetSpeedFactor: 1,
  })

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

// 0x00446ef0: |steering| below 40 becomes ±40, above 4096 becomes 0 (car body +0x64c).
export const setCarBodySteering = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  steering: number
): CarBody => Object.freeze({ ...body, steering: getClampedSteering(arithmetic, steering) })

// 0x00447f30 (thiscall: strength, damping, rate). The skid sound (0x00443bd0, sound 0x3a) is not modelled.
export const startCarBodySlide = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  body: CarBody,
  strength: number,
  damping: number,
  rate: number
): CarBody =>
  Object.freeze({
    ...body,
    slideStrength: strength,
    slideDamping: damping,
    flags: body.flags | SLIDING_FLAG,
    slideRate: rate,
    // _ftol truncates toward zero; the index is then masked with 0x3ff.
    slideCosine: getTableCosine(tables, Math.trunc(arithmetic.multiply(rate, SLIDE_PHASE_SCALE))),
  })

// 0x00448070. The skid sound (+0x6e8) is not modelled.
export const stopCarBodySlide = (body: CarBody): CarBody =>
  Object.freeze({
    ...body,
    slideCosine: -1,
    slideRate: PI,
    flags: body.flags & ~SLIDE_FLAGS,
  })

// 0x00449070.
export const startCarBodyPowerSlide = (body: CarBody, factor: number): CarBody =>
  Object.freeze({ ...body, flags: body.flags | POWER_SLIDE_FLAG, powerSlideFactor: factor })

// 0x00449090.
export const stopCarBodyPowerSlide = (body: CarBody): CarBody =>
  Object.freeze({
    ...body,
    flags: body.flags & ~POWER_SLIDE_FLAG,
    powerSlideFactor: DEFAULT_POWER_SLIDE_FACTOR,
  })

// 0x004489f0: average grip of the touching wheels times +0x5f4; 0 when none touches. The result stays on the FPU stack.
export const getCarBodyAverageGrip = (arithmetic: FloatArithmetic, body: CarBody): number => {
  const touching = body.wheels.filter((wheel) => (wheel.flags & WHEEL_TOUCHING_FLAG) !== 0)
  if (touching.length === 0) return 0
  const sum = touching.reduce((total, wheel) => arithmetic.add(total, wheel.grip), 0)
  return arithmetic.multiply(arithmetic.divide(sum, touching.length), body.gripScale)
}

// 0x00445cb0 (also through the thunk 0x0042ae10): forwardSpeed² · mass / (gravity · scaledMass · grip). Not stored.
export const getCarBodyMaximumCurvature = (arithmetic: FloatArithmetic, body: CarBody): number => {
  const { multiply, divide, getIsEqual } = arithmetic
  const support = multiply(
    multiply(body.gravity, body.scaledMass),
    getCarBodyAverageGrip(arithmetic, body)
  )
  if (getIsEqual(support, 0)) {
    return body.groundedWheelCount === 0 ? AIRBORNE_MAXIMUM_CURVATURE : MAXIMUM_STEERING
  }
  const speed = body.forwardSpeed
  return divide(multiply(multiply(speed, speed), body.rigidBody.mass), support)
}

// (t.z · r.z + t.y · r.y) + t.x · r.x with r the display frame's row 0; the order of 0x0042aea0 and 0x0042ae20.
const getTravelAlignment = (arithmetic: FloatArithmetic, body: CarBody): number => {
  const { add, multiply } = arithmetic
  const [rowX, rowY, rowZ] = body.displayFrame.rotation
  const { travelDirection: direction } = body
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
  if (getIsBelow(curvature, 0) && !getIsBelowOrEqual(body.steering, 0)) return true
  return !getIsBelowOrEqual(curvature, 0) && getIsBelow(body.steering, 0)
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
  if ((body.flags & SLIDING_FLAG) === 0 && !isAligned) return false
  if (body.contact !== 0) return false
  return getIsBelowOrEqual(body.speed, SLIDE_MAXIMUM_SPEED)
}

// 0x0042ae20: whether a power slide can start.
export const getIsCarBodyAbleToPowerSlide = (
  arithmetic: FloatArithmetic,
  body: CarBody
): boolean => {
  if (body.contact !== 0) return false
  if ((body.flags & AIRBORNE_CONTROL_FLAG) === 0 && body.groundedWheelCount < 3) return false
  if (arithmetic.getIsBelowOrEqual(getTravelAlignment(arithmetic, body), POWER_SLIDE_ALIGNMENT)) {
    return false
  }
  return !arithmetic.getIsBelow(body.forwardSpeed, POWER_SLIDE_MINIMUM_FORWARD_SPEED)
}

// 0x004483b0: |throttle| · mass / wheelRadius².
const getDriveFactor = (arithmetic: FloatArithmetic, body: CarBody, throttle: number): number => {
  const { multiply, divide, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const radiusSquared = multiply(body.wheelRadius, body.wheelRadius)
  if (getIsBelow(throttle, 0)) {
    return storeFloat(divide(multiply(body.rigidBody.mass, -throttle), radiusSquared))
  }
  if (getIsBelowOrEqual(throttle, 0)) return 0
  return storeFloat(divide(multiply(body.rigidBody.mass, throttle), radiusSquared))
}

// Car body slot 5, 0x0042ad30: 0x00448370(throttleScale · throttle), which stores +0x628 and calls 0x004483b0.
export const setCarBodyThrottle = (
  arithmetic: FloatArithmetic,
  body: CarBody,
  throttle: number
): CarBody => {
  const scaled = arithmetic.storeFloat(arithmetic.multiply(body.throttleScale, throttle))
  return Object.freeze({
    ...body,
    throttle: scaled,
    driveFactor: getDriveFactor(arithmetic, body, scaled),
  })
}

// Car body slot 10, 0x00448290: +0x5e4 is reduced by whole periods (+0x5e8) and becomes +0x5e0.
export const foldCarBodySpinTimer = (body: CarBody): CarBody => {
  const pending = body.pendingSpinMilliseconds
  if (pending === 0) return body
  const period = body.spinPeriodMilliseconds
  if (pending > period && period === 0) {
    throw new Error('0x00448290 never ends with a zero period and a pending time')
  }
  const remainder = pending > period ? ((pending - 1) % period) + 1 : pending
  return Object.freeze({
    ...body,
    pendingSpinMilliseconds: 0,
    spinTimerMilliseconds: remainder,
    spinPeriodMilliseconds: 0,
  })
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
  Object.freeze({
    ...body,
    rigidBody: Object.freeze({
      ...body.rigidBody,
      frame: Object.freeze({
        rotation: getMatrixFromQuaternion(arithmetic, body.safeOrientation),
        position: body.safePosition,
      }),
      linearVelocity: ZERO_VECTOR3,
      angularMomentum: ZERO_VECTOR3,
    }),
  })

export const getCarBodyPosition = (body: CarBody): Vector3 => body.rigidBody.frame.position

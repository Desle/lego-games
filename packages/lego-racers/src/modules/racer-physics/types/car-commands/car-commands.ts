import { getFloatFromBits, getStoredScaledVector } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { CarRigidBodyFlag } from '../car-rigid-body/car-rigid-body.ts'
import type { CarRigidBody } from '../racer-physics.types.ts'

// 0x00448800: the flag-0x80 countdown starts at 600 ms (MOV [ECX + 0x6e0], 0x258).
const FLAGGED_MILLISECONDS = 600
// 0x00449090: the lean factor goes back to 0.2 (0x004b0d80).
const DEFAULT_LEAN_FACTOR = getFloatFromBits(0x3e4ccccd)

// 0x004483b0: drag = mass × |throttle| / top speed², 0 without throttle.
const getWithDrag = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const { multiply, divide, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const squaredTopSpeed = multiply(body.topSpeed, body.topSpeed)
  const getDrag = (throttle: number): number =>
    storeFloat(divide(multiply(body.mass, throttle), squaredTopSpeed))
  if (getIsBelow(body.throttle, 0)) return Object.freeze({ ...body, drag: getDrag(-body.throttle) })
  if (getIsBelowOrEqual(body.throttle, 0)) return Object.freeze({ ...body, drag: 0 })
  return Object.freeze({ ...body, drag: getDrag(body.throttle) })
}

// Slot 5, 0x00448370 (thiscall: throttle). The car body's override (0x0042ad30) scales it by +0x72c first.
export const setThrottle = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  throttle: number
): CarRigidBody => getWithDrag(arithmetic, Object.freeze({ ...body, throttle }))

// Slot 6, 0x00448390 (thiscall: top speed). The car body's override (0x0042ad50) scales it by +0x730 first.
export const setTopSpeed = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  topSpeed: number
): CarRigidBody => getWithDrag(arithmetic, Object.freeze({ ...body, topSpeed }))

// Slot 7, 0x004480c0 (thiscall: impulse): velocity += impulse / mass.
export const addImpulse = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  impulse: Vector3
): CarRigidBody => {
  const { add, multiply, storeFloat } = arithmetic
  const change = getStoredScaledVector(arithmetic, impulse, body.inverseMass)
  return Object.freeze({
    ...body,
    linearVelocity: Object.freeze({
      x: storeFloat(add(multiply(body.inverseMass, impulse.x), body.linearVelocity.x)),
      y: storeFloat(add(change.y, body.linearVelocity.y)),
      z: storeFloat(add(change.z, body.linearVelocity.z)),
    }),
  })
}

// Slot 8, 0x00448110 (thiscall: direction, amount): velocity += direction × amount / mass.
export const addScaledImpulse = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  direction: Vector3,
  amount: number
): CarRigidBody => {
  const { add, multiply, storeFloat } = arithmetic
  const scale = multiply(body.inverseMass, amount)
  const change = getStoredScaledVector(arithmetic, direction, scale)
  return Object.freeze({
    ...body,
    linearVelocity: Object.freeze({
      x: storeFloat(add(change.x, body.linearVelocity.x)),
      y: storeFloat(add(change.y, body.linearVelocity.y)),
      z: storeFloat(add(multiply(scale, direction.z), body.linearVelocity.z)),
    }),
  })
}

// Slots 16 and 18, 0x00448760 and 0x004487b0 (thiscall: force): a force × scaled mass added every
// pass while flag 0x20 or 0x40 stays set; slots 17 and 19 (0x004487a0, 0x004487f0) clear the flag.
export const setExtraForce = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  slot: 'extraForceA' | 'extraForceB',
  force: Vector3 | undefined
): CarRigidBody => {
  const flag =
    slot === 'extraForceA' ? CarRigidBodyFlag.EXTRA_FORCE_A : CarRigidBodyFlag.EXTRA_FORCE_B
  if (force === undefined) return Object.freeze({ ...body, flags: body.flags & ~flag })
  return Object.freeze({
    ...body,
    [slot]: getStoredScaledVector(arithmetic, force, body.scaledMass),
    flags: body.flags | flag,
  })
}

// Slots 20 and 21, 0x00448800 and 0x00448820: start (600 ms) or stop the flag-0x80 countdown.
export const setFlaggedTimer = (body: CarRigidBody, isRunning: boolean): CarRigidBody =>
  Object.freeze({
    ...body,
    flaggedTimer: isRunning ? FLAGGED_MILLISECONDS : 0,
    flags: isRunning
      ? body.flags | CarRigidBodyFlag.FLAGGED
      : body.flags & ~CarRigidBodyFlag.FLAGGED,
  })

// 0x00449070 (thiscall: factor) and 0x00449090: the model leans into turns, or stops (factor 0.2).
export const setLeaning = (body: CarRigidBody, factor: number | undefined): CarRigidBody =>
  Object.freeze({
    ...body,
    leanFactor: factor ?? DEFAULT_LEAN_FACTOR,
    flags:
      factor === undefined
        ? body.flags & ~CarRigidBodyFlag.LEANING
        : body.flags | CarRigidBodyFlag.LEANING,
  })

import { setTopSpeed } from '../../../racer-physics/index.ts'
import type { CarRigidBody } from '../../../racer-physics/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { TopSpeedRating } from '../racer-setup.types.ts'

// float32 constants of the car body's rating setters.
const STEERING_SLOPE = getFloatFromBits(0x3b449ba6) // 0x004b054c, 0.003
const STEERING_BASE = getFloatFromBits(0x3f333333) // 0x004b0548, 0.7
const RATING_SLOPE = getFloatFromBits(0x3a83126f) // 0x004af220, 0.001
const ONE = getFloatFromBits(0x3f800000) // 0x004af388
// 0x004b0448: the top speed of a car body before its scale, 120.
export const BASE_TOP_SPEED = getFloatFromBits(0x42f00000)

export const NEUTRAL_RATING = 50
export const MAXIMUM_RATING = 100

// 0x0042ad70: car body +0x71c = rating, +0x728 = float32(rating · 0.003 + 0.7).
export const getSteeringScale = (arithmetic: FloatArithmetic, rating: number): number =>
  arithmetic.storeFloat(arithmetic.add(arithmetic.multiply(rating, STEERING_SLOPE), STEERING_BASE))

// 0x0042ada0 (throttle, +0x72c) and 0x0042add0 (top speed, +0x730): float32(1 − (50 − rating) · 0.001).
export const getRatingScale = (arithmetic: FloatArithmetic, rating: number): number =>
  arithmetic.storeFloat(
    arithmetic.subtract(ONE, arithmetic.multiply(NEUTRAL_RATING - rating, RATING_SLOPE))
  )

// 0x0042add0 ends with 0x00429330: clear car rigid body flag 0x10000, grip scale 1, car body +0x734 = 120, and
// car body slot 6 (0x0042ad50) sets the top speed to float32(+0x730 · 120) (0x00448390 and the drag 0x004483b0).
export const setTopSpeedRating = (
  arithmetic: FloatArithmetic,
  rigidBody: CarRigidBody,
  rating: number
): TopSpeedRating => {
  const scale = getRatingScale(arithmetic, rating)
  const topSpeed = arithmetic.storeFloat(arithmetic.multiply(scale, BASE_TOP_SPEED))
  const reset = Object.freeze({ ...rigidBody, flags: rigidBody.flags & ~0x10000, gripScale: 1 })
  return Object.freeze({ rigidBody: setTopSpeed(arithmetic, reset, topSpeed), scale })
}

import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type {
  ComputerBounce,
  ComputerSpeedState,
  ComputerSpeedStepInput,
} from '../racer-ai.types.ts'

// Car body +0x6c0 bits the computer speed code tests, named after what the code does with them.
// 0x40000: set by the push 0x00429990, cleared by 0x004298d0.
export const CAR_BODY_PUSHED_FLAG = 0x40000
// 0x10000: the target ramps from 2.75 down to 1.7 over the last 2,000 of car body +0x77c.
export const CAR_BODY_RAMPED_TARGET_FLAG = 0x10000
// 0x2: the target is 0.3 (0x004298d0) or 0.3 ± 0.1 (0x00429990).
export const CAR_BODY_SLOWED_FLAG = 0x2
// 0x80000: cleared by 0x004293c0; with 0x10000 and 0x2 it can hold the speed factor (mask 0x90002).
export const CAR_BODY_HELD_FLAG = 0x80000
const SPEED_HOLD_MASK = 0x90002
const TARGET_RESET_MASK = 0x50002
// Cleared when the bounce lands (AND AL,0x7f at 0x00429fb7).
const CAR_BODY_AIRBORNE_FLAG = 0x80

// float32 constants of 0x00429d40 and 0x00429990.
const PUSHED_ACCELERATION = Math.fround(0.002) // 0x004b04c8
const RAMPED_ACCELERATION = Math.fround(0.01) // 0x004b04c0
const ACCELERATION = 0.00048828125 // 0x004b04bc
const PUSHED_DECELERATION = 0.000732421875 // 0x004b04c4
const DECELERATION = Math.fround(0.002) // 0x004b04b8
const RAMP_DURATION = 2000 // 0x004b04e0
const RAMP_START_TARGET = 2.75 // 0x004b04a0
const RAMP_END_TARGET = Math.fround(1.7) // 0x004b0494
const LATERAL_RETURN_RATE = 0.001953125 // 0x004b04cc
const MILLISECONDS_TO_SECONDS = Math.fround(0.001) // 0x004af6fc
const BOUNCE_GRAVITY = -100 // 0x004b04d4
const SLOWED_TARGET = Math.fround(0.3) // 0x004b0490
const SLOWED_TARGET_SPREAD = Math.fround(0.1) // 0x004b0540
const PUSH_DIVISOR = 300 // 0x004b0484
const MAXIMUM_TARGET = 2.75 // 0x004b04a0
const MINIMUM_TARGET = -0.5 // 0x004b04a4
export const CONTACT_SPEED_FACTOR = Math.fround(-0.1) // 0x004b048c

// 0x00429d70..0x00429db7: with flag 0x10000 and a ramp time below 2,000, the target falls linearly
// from 2.75 to 1.7: (2.75 - 1.7) * -((time - 2000) / 2000) + 1.7.
export const getRampedTargetSpeedFactor = (
  arithmetic: FloatArithmetic,
  state: ComputerSpeedState,
  rampTime: number
): ComputerSpeedState => {
  const { add, subtract, multiply, divide, storeFloat, getIsBelow } = arithmetic
  if ((state.flags & CAR_BODY_RAMPED_TARGET_FLAG) === 0) return state
  if (!getIsBelow(rampTime, RAMP_DURATION)) return state
  const remaining = -divide(subtract(rampTime, RAMP_DURATION), RAMP_DURATION)
  const target = storeFloat(
    add(multiply(subtract(RAMP_START_TARGET, RAMP_END_TARGET), remaining), RAMP_END_TARGET)
  )
  return Object.freeze({ ...state, targetSpeedFactor: target })
}

// 0x00429de0..0x00429ea2: move the speed factor toward the target by rate * step, without overshooting.
export const stepComputerSpeedFactor = (
  arithmetic: FloatArithmetic,
  input: ComputerSpeedStepInput
): ComputerSpeedState => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const { state, contactState, stepMilliseconds } = input
  const { flags, speedFactor, targetSpeedFactor } = state
  const isPushed = (flags & CAR_BODY_PUSHED_FLAG) !== 0
  const isHeld = !isPushed && (flags & SPEED_HOLD_MASK) !== 0 && contactState !== 0
  if (isHeld) return state
  if (getIsBelow(speedFactor, targetSpeedFactor)) {
    const rate = isPushed
      ? PUSHED_ACCELERATION
      : (flags & CAR_BODY_RAMPED_TARGET_FLAG) !== 0
        ? RAMPED_ACCELERATION
        : ACCELERATION
    const raised = add(speedFactor, multiply(rate, stepMilliseconds))
    const next = getIsBelowOrEqual(raised, targetSpeedFactor)
      ? storeFloat(raised)
      : targetSpeedFactor
    return Object.freeze({ ...state, speedFactor: next })
  }
  if (getIsBelowOrEqual(speedFactor, targetSpeedFactor)) return state
  const rate = isPushed ? PUSHED_DECELERATION : DECELERATION
  const lowered = subtract(speedFactor, multiply(rate, stepMilliseconds))
  const next = getIsBelow(lowered, targetSpeedFactor) ? targetSpeedFactor : storeFloat(lowered)
  return Object.freeze({ ...state, speedFactor: next })
}

// 0x00429eb4..0x00429f22: the sideways offset (car body +0x7cc) returns to 0 at 0.001953125 per ms.
export const getReturnedLateralOffset = (
  arithmetic: FloatArithmetic,
  lateralOffset: number,
  stepMilliseconds: number
): number => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  if (!getIsBelowOrEqual(lateralOffset, 0)) {
    // FST stores the result; FCOMP compares the unrounded value still on the stack.
    const lowered = subtract(lateralOffset, multiply(LATERAL_RETURN_RATE, stepMilliseconds))
    return getIsBelow(lowered, 0) ? 0 : storeFloat(lowered)
  }
  if (!getIsBelow(lateralOffset, 0)) return lateralOffset
  const raised = add(multiply(LATERAL_RETURN_RATE, stepMilliseconds), lateralOffset)
  return getIsBelowOrEqual(raised, 0) ? storeFloat(raised) : 0
}

// 0x00429f4c..0x00429fbf: while height or vertical speed is non-zero, fall at 100 per second²; landing
// (height <= 0) zeroes both and clears flag 0x80.
export const stepComputerBounce = (
  arithmetic: FloatArithmetic,
  bounce: ComputerBounce,
  stepMilliseconds: number
): ComputerBounce => {
  const { add, multiply, storeFloat, getIsEqual, getIsBelowOrEqual } = arithmetic
  if (getIsEqual(bounce.verticalSpeed, 0) && getIsEqual(bounce.height, 0)) return bounce
  const seconds = multiply(stepMilliseconds, MILLISECONDS_TO_SECONDS)
  const unroundedSpeed = add(multiply(BOUNCE_GRAVITY, seconds), bounce.verticalSpeed)
  const unroundedHeight = add(multiply(seconds, unroundedSpeed), bounce.height)
  if (getIsBelowOrEqual(unroundedHeight, 0)) {
    return Object.freeze({
      flags: bounce.flags & ~CAR_BODY_AIRBORNE_FLAG,
      height: 0,
      verticalSpeed: 0,
    })
  }
  return Object.freeze({
    flags: bounce.flags,
    height: storeFloat(unroundedHeight),
    verticalSpeed: storeFloat(unroundedSpeed),
  })
}

// 0x00429990 (car body slot, thiscall: vector): a push sets flag 0x40000 and moves the target by the
// push along the car's forward axis (car body +0x168) / 300, clamped to [-0.5, 2.75].
export const getPushedSpeedState = (
  arithmetic: FloatArithmetic,
  state: ComputerSpeedState,
  forwardAxis: Vector3,
  push: Vector3
): ComputerSpeedState => {
  const { add, subtract, multiply, divide, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const flags = state.flags | CAR_BODY_PUSHED_FLAG
  const unroundedAlong = add(
    add(multiply(forwardAxis.z, push.z), multiply(forwardAxis.y, push.y)),
    multiply(forwardAxis.x, push.x)
  )
  // FST float ptr [ESP+4] keeps a rounded copy for the division; FCOMP tests the unrounded sum.
  const along = storeFloat(unroundedAlong)
  const isSlowed = (flags & CAR_BODY_SLOWED_FLAG) !== 0
  if (getIsBelow(unroundedAlong, 0)) {
    const target = storeFloat(
      isSlowed
        ? subtract(SLOWED_TARGET, SLOWED_TARGET_SPREAD)
        : add(divide(along, PUSH_DIVISOR), state.speedFactor)
    )
    return Object.freeze({
      ...state,
      flags,
      targetSpeedFactor: getIsBelow(target, MINIMUM_TARGET) ? MINIMUM_TARGET : target,
    })
  }
  const target = storeFloat(
    isSlowed
      ? add(SLOWED_TARGET, SLOWED_TARGET_SPREAD)
      : add(divide(along, PUSH_DIVISOR), state.speedFactor)
  )
  return Object.freeze({
    ...state,
    flags,
    targetSpeedFactor: getIsBelowOrEqual(target, MAXIMUM_TARGET) ? target : MAXIMUM_TARGET,
  })
}

// 0x004298d0 → 0x00429940 (route-driven car bodies): clear flag 0x40000; the target becomes 0.3 when
// slowed, else the default target (reset to 1.0 when it is negative).
export const getRestoredSpeedState = (
  arithmetic: FloatArithmetic,
  state: ComputerSpeedState
): ComputerSpeedState => {
  const flags = state.flags & ~CAR_BODY_PUSHED_FLAG
  if ((flags & CAR_BODY_SLOWED_FLAG) !== 0) {
    return Object.freeze({ ...state, flags, targetSpeedFactor: SLOWED_TARGET })
  }
  const defaultTarget = arithmetic.getIsBelow(state.defaultTargetSpeedFactor, 0)
    ? 1
    : state.defaultTargetSpeedFactor
  return Object.freeze({
    ...state,
    flags,
    defaultTargetSpeedFactor: defaultTarget,
    targetSpeedFactor: defaultTarget,
  })
}

// 0x004293c0: clear flag 0x80000; a route-driven body with none of 0x50002 gets the target 1.0.
export const getReleasedSpeedState = (
  state: ComputerSpeedState,
  isRouteDriven: boolean
): ComputerSpeedState => {
  const flags = state.flags & ~CAR_BODY_HELD_FLAG
  const isReset = isRouteDriven && (flags & TARGET_RESET_MASK) === 0
  return Object.freeze({
    ...state,
    flags,
    targetSpeedFactor: isReset ? 1 : state.targetSpeedFactor,
  })
}

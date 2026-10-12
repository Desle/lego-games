import { foldCarBodySpinTimer } from '../../types/car-body/car-body.ts'
import { setDriverSteering, setDriverThrottle } from '../../types/racer-driver/racer-driver.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type {
  PlayerController,
  PlayerControllerInput,
  PlayerControllerState,
  Pedals,
  RacerControls,
  SteeringTarget,
} from '../../types/racer.types.ts'
import {
  startRacerPowerSlide,
  stopRacerPowerSlide,
} from '../racer-power-slide/racer-power-slide.ts'

const STEER_POSITIVE_FLAG = 0x1
const STEER_NEGATIVE_FLAG = 0x2
const STEER_FLAGS = 0x3
const ACCELERATE_FLAG = 0x4
const BRAKE_FLAG = 0x8
const USE_POWER_UP_FLAG = 0x10
const CHANGE_CAMERA_FLAG = 0x20
const CHANGE_HUD_MODE_FLAG = 0x40
const POWER_SLIDE_FLAG = 0x80
const LOOK_BEHIND_FLAG = 0x100

const BEFORE_START_FLAG = 0x1
const DISABLED_FLAGS = 0x3
const ACCELERATING_FLAG = 0x8

const RACER_POWER_SLIDING_FLAG = 0x80
const CAR_BODY_SPIN_FLAG = 0x2
const STRONG_START_BOOST_MILLISECONDS = 59
const START_BOOST_HOLD_MILLISECONDS = 2000
const START_BOOST_WINDOW_MILLISECONDS = 100

// float32 constants of 0x00430120 and 0x00430390.
const STEP_SECONDS = Math.fround(0.001) // 0x004af220
const ANALOG_STEERING_RATE = 2.5 // 0x004b0740
const DIGITAL_STEERING_RATE = 1.25 // 0x004b0744
const COUNTER_STEERING_RATE = 8.25 // 0x004b0748
const POWER_SLIDE_STEERING_RATE = 5 // 0x004b074c
const BRAKING_POWER_SLIDE_STEERING_RATE = 16 // 0x004b0750
const STEERING_LIMIT = 1 // 0x004b0754
const BRAKING_WHILE_ACCELERATING_THROTTLE = 0.5 // 0x004b0758

// The binding flags RacerControls holds, in binding order.
const getBindingFlags = (controls: RacerControls): number =>
  (controls.isSteerPositivePressed ? STEER_POSITIVE_FLAG : 0) |
  (controls.isSteerNegativePressed ? STEER_NEGATIVE_FLAG : 0) |
  (controls.isAcceleratePressed ? ACCELERATE_FLAG : 0) |
  (controls.isBrakePressed ? BRAKE_FLAG : 0) |
  (controls.isUsePowerUpPressed ? USE_POWER_UP_FLAG : 0) |
  (controls.isChangeCameraPressed ? CHANGE_CAMERA_FLAG : 0) |
  (controls.isChangeHudModePressed ? CHANGE_HUD_MODE_FLAG : 0) |
  (controls.isPowerSlidePressed ? POWER_SLIDE_FLAG : 0) |
  (controls.isLookBehindPressed ? LOOK_BEHIND_FLAG : 0)

// 0x00430020 with 0x00430840.
export const createPlayerController = (isThrottleAxisEnabled: boolean): PlayerController =>
  Object.freeze({
    bindingFlags: 0,
    stateFlags: 0,
    startBoostMilliseconds: 0,
    accelerateMilliseconds: 0,
    steering: 0,
    isThrottleAxisEnabled,
  })

const setController = (
  state: PlayerControllerState,
  changes: Partial<PlayerController>
): PlayerControllerState =>
  Object.freeze({ ...state, controller: Object.freeze({ ...state.controller, ...changes }) })

// 0x00430790: before the start, holding accelerate over 2 s opens a 100 ms window; after it, accelerating in the window boosts.
const updateStartBoost = (input: PlayerControllerInput): PlayerControllerState => {
  const { state, context, racerIndex, dependencies } = input
  const { controller } = state
  if ((controller.stateFlags & BEFORE_START_FLAG) !== 0) {
    if (controller.accelerateMilliseconds <= START_BOOST_HOLD_MILLISECONDS) return state
    return setController(state, {
      startBoostMilliseconds: START_BOOST_WINDOW_MILLISECONDS,
      accelerateMilliseconds: 0,
    })
  }
  if (controller.startBoostMilliseconds === 0 || (controller.stateFlags & DISABLED_FLAGS) !== 0) {
    return state
  }
  const racerSet = dependencies.triggerStartBoost(
    context,
    state.racerSet,
    racerIndex,
    controller.startBoostMilliseconds > STRONG_START_BOOST_MILLISECONDS
  )
  return setController({ ...state, racerSet }, { startBoostMilliseconds: 0 })
}

const pressBinding = (input: PlayerControllerInput, flag: number): PlayerControllerState => {
  const { context, racerIndex, dependencies } = input
  const { controller, racerSet } = input.state
  const pressed = setController(input.state, { bindingFlags: controller.bindingFlags | flag })
  const at = (state: PlayerControllerState): PlayerControllerInput => ({ ...input, state })
  if (flag === ACCELERATE_FLAG) return updateStartBoost(at(pressed))
  if (flag === BRAKE_FLAG) {
    const racer = getRacer(racerSet, racerIndex)
    if ((racer.carBody.rigidBody.flags & CAR_BODY_SPIN_FLAG) === 0) return pressed
    const folded = Object.freeze({ ...racer, carBody: foldCarBodySpinTimer(racer.carBody) })
    return Object.freeze({ ...pressed, racerSet: setRacer(racerSet, racerIndex, folded) })
  }
  if (flag === USE_POWER_UP_FLAG) {
    if ((controller.stateFlags & DISABLED_FLAGS) !== 0) return input.state
    const used = dependencies.usePowerUp(context, racerSet, racerIndex, 0)
    return Object.freeze({ ...pressed, racerSet: used })
  }
  if (flag === CHANGE_CAMERA_FLAG) {
    return Object.freeze({
      ...pressed,
      racerSet: dependencies.changeCamera(context, racerSet, racerIndex, 0),
    })
  }
  if (flag === CHANGE_HUD_MODE_FLAG) {
    return Object.freeze({
      ...pressed,
      racerSet: dependencies.changeHudMode(context, racerSet, racerIndex, 0),
    })
  }
  if (flag === LOOK_BEHIND_FLAG) {
    return Object.freeze({
      ...pressed,
      racerSet: dependencies.setLookBehind(context, racerSet, racerIndex, true),
    })
  }
  return pressed
}

const releaseBinding = (input: PlayerControllerInput, flag: number): PlayerControllerState => {
  const { context, racerIndex, dependencies, state } = input
  const flags = state.controller.bindingFlags & ~flag
  if (flag === ACCELERATE_FLAG) {
    return setController(state, { bindingFlags: flags, accelerateMilliseconds: 0 })
  }
  if (flag === USE_POWER_UP_FLAG && (state.controller.stateFlags & DISABLED_FLAGS) !== 0) {
    return state
  }
  const released = setController(state, { bindingFlags: flags })
  if (flag !== LOOK_BEHIND_FLAG) return released
  return Object.freeze({
    ...released,
    racerSet: dependencies.setLookBehind(context, released.racerSet, racerIndex, false),
  })
}

const BINDING_ORDER = Object.freeze([
  STEER_POSITIVE_FLAG,
  STEER_NEGATIVE_FLAG,
  ACCELERATE_FLAG,
  BRAKE_FLAG,
  USE_POWER_UP_FLAG,
  CHANGE_CAMERA_FLAG,
  CHANGE_HUD_MODE_FLAG,
  POWER_SLIDE_FLAG,
  LOOK_BEHIND_FLAG,
])

// The handlers 0x00430570..0x004306d0 that the device callback 0x004309c0 calls on each press and release,
// applied in binding order for every binding whose state differs from the last frame.
export const applyRacerControls = (
  input: PlayerControllerInput,
  controls: RacerControls
): PlayerControllerState => {
  const wanted = getBindingFlags(controls)
  return BINDING_ORDER.reduce((state, flag) => {
    const isHeld = (state.controller.bindingFlags & flag) !== 0
    const isWanted = (wanted & flag) !== 0
    if (isHeld === isWanted) return state
    const at = { ...input, state }
    return isWanted ? pressBinding(at, flag) : releaseBinding(at, flag)
  }, input.state)
}

// 0x00430c20 (the pause menu releases the controls): every binding handler is called with 0, whether the binding was held or not.
export const releaseAllBindings = (input: PlayerControllerInput): PlayerControllerState =>
  BINDING_ORDER.reduce((state, flag) => releaseBinding({ ...input, state }, flag), input.state)

// The target the steering moves towards at `rate` per second, and its limits (0x00430120).
const getSteeringTarget = (
  input: PlayerControllerInput,
  controls: RacerControls,
  rate: number
): SteeringTarget => {
  const { add, multiply, subtract, storeFloat, getIsBelow, getIsBelowOrEqual } =
    input.context.arithmetic
  const { bindingFlags, steering } = input.state.controller
  const recentre = (): SteeringTarget => {
    if (!getIsBelowOrEqual(steering, 0))
      return { speed: -COUNTER_STEERING_RATE, upper: STEERING_LIMIT, lower: 0 }
    if (getIsBelow(steering, 0))
      return { speed: COUNTER_STEERING_RATE, upper: 0, lower: -STEERING_LIMIT }
    return { speed: 0, upper: 0, lower: 0 }
  }
  const limits = { upper: STEERING_LIMIT, lower: -STEERING_LIMIT }
  const nonZero = (target: SteeringTarget): SteeringTarget =>
    input.context.arithmetic.getIsEqual(target.speed, 0) ? recentre() : target
  if ((bindingFlags & STEER_FLAGS) !== 0) {
    const isPositive = (bindingFlags & STEER_POSITIVE_FLAG) !== 0
    const isNegative = (bindingFlags & STEER_NEGATIVE_FLAG) !== 0
    if (isPositive === isNegative) return recentre()
    if (isPositive) {
      return nonZero({ ...limits, speed: getIsBelow(steering, 0) ? COUNTER_STEERING_RATE : rate })
    }
    return nonZero({
      ...limits,
      speed: !getIsBelowOrEqual(steering, 0) ? -COUNTER_STEERING_RATE : -rate,
    })
  }
  const negated = -controls.steeringAxis
  const axis = !getIsBelowOrEqual(negated, 1) ? 1 : getIsBelow(negated, -1) ? -1 : negated
  if (!getIsBelowOrEqual(axis, 0)) {
    const upper = storeFloat(axis)
    if (getIsBelow(steering, 0)) return nonZero({ ...limits, upper, speed: COUNTER_STEERING_RATE })
    return nonZero({
      ...limits,
      upper,
      speed: multiply(add(multiply(subtract(1, axis), 0.5), 0.5), rate),
    })
  }
  if (!getIsBelow(axis, 0)) return recentre()
  const lower = storeFloat(axis)
  if (!getIsBelowOrEqual(steering, 0))
    return nonZero({ ...limits, lower, speed: -COUNTER_STEERING_RATE })
  return nonZero({
    ...limits,
    lower,
    speed: multiply(add(multiply(add(axis, 1), 0.5), 0.5), -rate),
  })
}

const getSteeringRate = (input: PlayerControllerInput): number => {
  const racer = getRacer(input.state.racerSet, input.racerIndex)
  const isDigital = (input.state.controller.bindingFlags & STEER_FLAGS) !== 0
  if ((racer.flags & RACER_POWER_SLIDING_FLAG) !== 0) {
    return racer.driver.slideDirection === 1
      ? BRAKING_POWER_SLIDE_STEERING_RATE
      : POWER_SLIDE_STEERING_RATE
  }
  return isDigital ? DIGITAL_STEERING_RATE : ANALOG_STEERING_RATE
}

// PlayerController_UpdateSteering 0x00430120 (thiscall: frame milliseconds).
const updateSteering = (
  input: PlayerControllerInput,
  controls: RacerControls,
  frameMilliseconds: number
): PlayerControllerState => {
  const { add, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = input.context.arithmetic
  const stepSeconds = storeFloat(multiply(frameMilliseconds, STEP_SECONDS))
  const target = getSteeringTarget(input, controls, getSteeringRate(input))
  const moved = add(multiply(target.speed, stepSeconds), input.state.controller.steering)
  const isAbove = !getIsBelowOrEqual(moved, target.upper)
  const steering = isAbove
    ? target.upper
    : getIsBelow(moved, target.lower)
      ? target.lower
      : storeFloat(moved)
  const steered = setController(input.state, { steering })
  if ((steered.controller.stateFlags & DISABLED_FLAGS) !== 0) return steered
  const racer = getRacer(steered.racerSet, input.racerIndex)
  const driver = setDriverSteering(input.context.arithmetic, racer.driver, racer.carBody, steering)
  return Object.freeze({
    ...steered,
    racerSet: setRacer(steered.racerSet, input.racerIndex, Object.freeze({ ...racer, driver })),
  })
}

const getPedals = (input: PlayerControllerInput, controls: RacerControls): Pedals => {
  const { controller } = input.state
  const negated = -controls.throttleAxis
  const isAxisBraking =
    controller.isThrottleAxisEnabled && input.context.arithmetic.getIsBelow(negated, 0)
  const axisAccelerate =
    controller.isThrottleAxisEnabled && !isAxisBraking
      ? input.context.arithmetic.storeFloat(negated)
      : 0
  const axisBrake = isAxisBraking ? input.context.arithmetic.storeFloat(negated) : 0
  return {
    accelerate: (controller.bindingFlags & ACCELERATE_FLAG) !== 0 ? 1 : axisAccelerate,
    brake: (controller.bindingFlags & BRAKE_FLAG) !== 0 ? -1 : axisBrake,
  }
}

// 0x00430390, the power slide part: held with accelerate it starts (direction 1 when braking) or, without steering, ends.
const updatePowerSlide = (
  input: PlayerControllerInput,
  isSlideHeld: boolean,
  brake: number
): PlayerControllerState => {
  const { context, racerIndex, dependencies, state } = input
  const { getIsBelow, getIsEqual } = context.arithmetic
  const isRacerSliding =
    (getRacer(state.racerSet, racerIndex).flags & RACER_POWER_SLIDING_FLAG) !== 0
  const stop = (): PlayerControllerState =>
    Object.freeze({
      ...state,
      racerSet: stopRacerPowerSlide(
        context,
        state.racerSet,
        racerIndex,
        dependencies.endPowerSlideEffects
      ),
    })
  if (!isSlideHeld) return isRacerSliding ? stop() : state
  if ((state.controller.stateFlags & DISABLED_FLAGS) !== 0) return state
  if (getIsEqual(state.controller.steering, 0)) return stop()
  if (isRacerSliding) return state
  return Object.freeze({
    ...state,
    racerSet: startRacerPowerSlide(
      context,
      state.racerSet,
      racerIndex,
      getIsBelow(brake, 0) ? 1 : 0,
      dependencies.startPowerSlideEffects
    ),
  })
}

// 0x00430390: throttle and power slide from the pedals.
const updateThrottle = (
  input: PlayerControllerInput,
  controls: RacerControls
): PlayerControllerState => {
  const { arithmetic } = input.context
  const { add, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const { accelerate, brake } = getPedals(input, controls)
  const sum = storeFloat(add(accelerate, brake))
  const pedalled = !getIsBelowOrEqual(sum, 0)
    ? updateStartBoost(input)
    : getIsBelow(sum, 0)
      ? setController(input.state, { accelerateMilliseconds: 0 })
      : input.state
  const isAccelerating = !getIsBelowOrEqual(accelerate, 0)
  const { stateFlags, bindingFlags } = pedalled.controller
  const flagged = setController(pedalled, {
    stateFlags: isAccelerating ? stateFlags | ACCELERATING_FLAG : stateFlags & ~ACCELERATING_FLAG,
  })
  const isSlideHeld = isAccelerating && (bindingFlags & POWER_SLIDE_FLAG) !== 0
  const isDisabled = (stateFlags & DISABLED_FLAGS) !== 0
  const slid = updatePowerSlide({ ...input, state: flagged }, isSlideHeld, brake)
  if (isDisabled) return slid
  const racer = getRacer(slid.racerSet, input.racerIndex)
  const isSliding = (racer.flags & RACER_POWER_SLIDING_FLAG) !== 0
  const held = isSlideHeld ? 1 : sum
  const throttle =
    !isSliding && getIsBelow(brake, 0) && isAccelerating
      ? BRAKING_WHILE_ACCELERATING_THROTTLE
      : held
  const driver = setDriverThrottle(arithmetic, racer.driver, racer.carBody, throttle)
  return Object.freeze({
    ...slid,
    racerSet: setRacer(slid.racerSet, input.racerIndex, Object.freeze({ ...racer, driver })),
  })
}

// PlayerController_Update 0x00430530 (thiscall: frame milliseconds), run once per frame by Race_Update before the sub-steps.
export const updatePlayerController = (
  input: PlayerControllerInput,
  controls: RacerControls,
  frameMilliseconds: number
): PlayerControllerState => {
  const { controller } = input.state
  const counted = setController(input.state, {
    startBoostMilliseconds:
      controller.startBoostMilliseconds < frameMilliseconds
        ? 0
        : controller.startBoostMilliseconds - frameMilliseconds,
    accelerateMilliseconds: (controller.accelerateMilliseconds + frameMilliseconds) >>> 0,
  })
  const steered = updateSteering({ ...input, state: counted }, controls, frameMilliseconds)
  return updateThrottle({ ...input, state: steered }, controls)
}

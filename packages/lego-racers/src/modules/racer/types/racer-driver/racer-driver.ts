import { drawRandomValue } from '../../../random-table/index.ts'
import type { RandomTablePosition } from '../../../random-table/index.ts'
import {
  advanceRouteFollower,
  createRouteFollower,
  setRouteFollowerSpeedFactor,
  startRouteFollowerAtLoop,
} from '../../../racer-ai/index.ts'
import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Quaternion } from '../../../simulation-math/index.ts'
import {
  getCarBodyMaximumCurvature,
  getIsCarBodyAbleToPowerSlide,
  getIsCarBodyAbleToSlide,
  setCarBodySteering,
  setCarBodyThrottle,
  startCarBodyPowerSlide,
  startCarBodySlide,
  stopCarBodyPowerSlide,
  stopCarBodySlide,
} from '../car-body/car-body.ts'
import type {
  CarBody,
  DrivenCarBody,
  DriverUpdate,
  DriverWobble,
  RacerDriver,
  RacerTables,
  SteeringRequest,
} from '../racer.types.ts'

// float32 constants of the driver (0x004b0058..0x004b00a0) and shared ones.
const ONE = 1
const HALF = 0.5
const STEERING_FACTOR = Math.fround(0.025) // 0x004b005c
const STEERING_OFFSET = Math.fround(0.00025) // 0x004b0060
const THROTTLE_FORCE = 54 // 0x004b0064
const BRAKING_MULTIPLIER = 2 // 0x004b0068
const SLOW_SPEED = Math.fround(0.04) // 0x004b006c
const SLOW_STEERING_SCALE = Math.fround(0.2) // 0x004b0070
const HOLD_THROTTLE_SCALE = 1 // 0x004b0074
const MINIMUM_SLIDE_EXCESS = Math.fround(0.05) // 0x004b007c
const POWER_SLIDE_MINIMUM_FORWARD_SPEED = Math.fround(0.03) // 0x004b0080
const SLIDE_BOOST_MULTIPLIER = 8 // 0x004b0098
const WOBBLE_STEP = Math.fround(0.01) // 0x004af668
const WOBBLE_STEERING_OFFSET = 2 // 0x004b009c
// 0x004c4810, set once by 0x0041fb30 to 54 · 8.
const FULL_THROTTLE = THROTTLE_FORCE * SLIDE_BOOST_MULTIPLIER
const SLIDE_DAMPING = Math.fround(0.85) // 0x3f59999a
const BRAKING_SLIDE_DAMPING = 0.25 // 0x3e800000
const SLIDE_RATE = Math.fround(Math.PI) // 0x40490fdb
const STEERING_SLIDE_RATE = Math.fround(Math.SQRT1_2) // 0x3f350481
const POWER_SLIDE_FACTOR = Math.fround(0.3) // 0x3e99999a
const BRAKING_POWER_SLIDE_FACTOR = Math.fround(0.4) // 0x3ecccccd
const SLIDE_BOOST_MILLISECONDS = 300 // 0x12c

const STUCK_SPEED = Math.fround(0.009) // 0x004b0084
const STUCK_MILLISECONDS = 1000 // 0x3e8
const REVERSING_MILLISECONDS = 2000 // 0x7d0
const ROUTE_TARGET_STEP_MILLISECONDS = 250 // 0xfa
const INITIAL_ROUTE_TARGET_MILLISECONDS = 1000 // 0x3e8
const REVERSING_FLAG = 0x20
const ON_ROUTE_FLAG = 0x40
const SPINNING_FLAG = 0x2

const FULL_THROTTLE_FLAG = 0x1
const HOLD_FLAG = 0x2
const POWER_SLIDE_FLAG = 0x4
const SLIDE_BOOST_FLAG = 0x8
const WOBBLE_FLAG = 0x10
const TOUCHING_FULL_THROTTLE_FLAG = 0x100

const ZERO_QUATERNION: Quaternion = Object.freeze({ x: 0, y: 0, z: 0, w: 0 })

const toUnsigned = (value: number): number => value >>> 0

// 0x0041fb80 (reached through the constructor 0x0041fb50): every field zero.
export const createRacerDriver = (): RacerDriver =>
  Object.freeze({
    route: null,
    previousCurvature: 0,
    curvature: 0,
    throttle: 0,
    flags: 0,
    wobbleSteering: 0,
    wobbleThrottle: 0,
    wobbleMilliseconds: 0,
    routeStepMilliseconds: 0,
    stuckMilliseconds: 0,
    slideMilliseconds: 0,
    slideDirection: 0,
    targetPosition: ZERO_VECTOR3,
    targetRotation: ZERO_QUATERNION,
    follower: null,
  })

const getSteeringCurvature = (arithmetic: FloatArithmetic, scaledSteering: number): number => {
  const { add, subtract, multiply, divide, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const scaled = storeFloat(multiply(subtract(STEERING_FACTOR, STEERING_OFFSET), scaledSteering))
  if (!getIsBelowOrEqual(scaledSteering, 0)) {
    return storeFloat(divide(ONE, add(STEERING_OFFSET, scaled)))
  }
  if (getIsBelow(scaledSteering, 0)) {
    return storeFloat(divide(ONE, subtract(scaled, STEERING_OFFSET)))
  }
  return 0
}

// 0x0041fe60 (thiscall: steering in [-1, 1]): curvature = 1 / (0.00025 + (0.025 - 0.00025) · s · scale), signed.
export const setDriverSteering = (
  arithmetic: FloatArithmetic,
  driver: RacerDriver,
  carBody: CarBody,
  steering: number
): RacerDriver => {
  const signed = (driver.flags & WOBBLE_FLAG) === 0 ? steering : -steering
  const scaledSteering = arithmetic.multiply(signed, carBody.steeringScale)
  return Object.freeze({ ...driver, curvature: getSteeringCurvature(arithmetic, scaledSteering) })
}

const getWobbledThrottle = (
  arithmetic: FloatArithmetic,
  driver: RacerDriver,
  throttle: number
): number => {
  if ((driver.flags & WOBBLE_FLAG) === 0) return throttle
  const sum = arithmetic.add(throttle, driver.wobbleThrottle)
  if (!arithmetic.getIsBelowOrEqual(sum, 1)) return 1
  return arithmetic.getIsBelow(sum, -1) ? -1 : sum
}

// Braking against the motion doubles the force (both tests of 0x00420130 on car body +0x618).
const getIsBraking = (arithmetic: FloatArithmetic, throttle: number, forwardSpeed: number) => {
  const { getIsBelow, getIsBelowOrEqual } = arithmetic
  if (getIsBelow(throttle, 0)) return !getIsBelowOrEqual(forwardSpeed, 0)
  return !getIsBelowOrEqual(throttle, 0) && getIsBelow(forwardSpeed, 0)
}

// 0x00420130 (thiscall: throttle in [-1, 1]): driver +0x10 = 54 · throttle, doubled when braking.
export const setDriverThrottle = (
  arithmetic: FloatArithmetic,
  driver: RacerDriver,
  carBody: CarBody,
  throttle: number
): RacerDriver => {
  const { multiply, storeFloat } = arithmetic
  const value = getWobbledThrottle(arithmetic, driver, throttle)
  const force = multiply(THROTTLE_FORCE, value)
  const isBraking = getIsBraking(arithmetic, value, carBody.rigidBody.forwardSpeed)
  return Object.freeze({
    ...driver,
    throttle: storeFloat(isBraking ? multiply(force, BRAKING_MULTIPLIER) : force),
  })
}

const applyCurvature = (
  arithmetic: FloatArithmetic,
  driven: DrivenCarBody,
  curvature: number
): DrivenCarBody =>
  Object.freeze({
    driver: Object.freeze({ ...driven.driver, curvature }),
    carBody: setCarBodySteering(arithmetic, driven.carBody, curvature),
  })

const getSignedCurvature = (
  arithmetic: FloatArithmetic,
  magnitude: number,
  curvature: number
): number => arithmetic.storeFloat(arithmetic.getIsBelow(curvature, 0) ? -magnitude : magnitude)

// The end of both branches of 0x0041fee0: below the limit the curvature becomes `getAdjusted(maximum)`, signed.
const finishSteering = (
  request: SteeringRequest,
  carBody: CarBody,
  maximum: number,
  getAdjusted: (maximum: number) => number
): DrivenCarBody => {
  const { arithmetic, driven, curvature, magnitude } = request
  const updated = { driver: driven.driver, carBody }
  if (!arithmetic.getIsBelow(magnitude, maximum)) {
    return applyCurvature(arithmetic, updated, curvature)
  }
  return applyCurvature(
    arithmetic,
    updated,
    getSignedCurvature(arithmetic, getAdjusted(maximum), curvature)
  )
}

// 0x0041fee0, flag 0x4 (power slide).
const applyPowerSlideSteering = (request: SteeringRequest): DrivenCarBody => {
  const { arithmetic, tables, driven, curvature, magnitude } = request
  const { add, subtract, multiply, divide, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const { driver, carBody } = driven
  if (!getIsCarBodyAbleToSlide(arithmetic, carBody, curvature) || getIsBelowOrEqual(magnitude, 0)) {
    return applyCurvature(arithmetic, { driver, carBody: stopCarBodySlide(carBody) }, curvature)
  }
  const maximum = storeFloat(getCarBodyMaximumCurvature(arithmetic, carBody))
  const ratio = subtract(ONE, divide(magnitude, maximum))
  const excess = getIsBelow(ratio, MINIMUM_SLIDE_EXCESS) ? MINIMUM_SLIDE_EXCESS : ratio
  const isBraking = driver.slideDirection === 1
  const strength = storeFloat(add(isBraking ? add(excess, excess) : excess, ONE))
  const damping = isBraking ? BRAKING_SLIDE_DAMPING : SLIDE_DAMPING
  const sliding = startCarBodySlide(arithmetic, tables, carBody, strength, damping, SLIDE_RATE)
  return finishSteering(request, sliding, maximum, (limit) =>
    add(multiply(multiply(subtract(limit, magnitude), HALF), HALF), magnitude)
  )
}

// 0x0041fee0 without flags 0x4 and 0x2: a slide starts when steering hard; the curvature moves towards the limit.
const applyNormalSteering = (request: SteeringRequest): DrivenCarBody => {
  const { arithmetic, tables, driven, curvature, magnitude } = request
  const { add, subtract, multiply, divide, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const { carBody } = driven
  const maximum = storeFloat(getCarBodyMaximumCurvature(arithmetic, carBody))
  const isSlideStarting =
    getIsCarBodyAbleToSlide(arithmetic, carBody, curvature) &&
    getIsBelow(magnitude, maximum) &&
    !getIsBelowOrEqual(magnitude, 0)
  const slidBody = isSlideStarting
    ? startCarBodySlide(
        arithmetic,
        tables,
        carBody,
        storeFloat(add(subtract(ONE, divide(magnitude, maximum)), ONE)),
        SLIDE_DAMPING,
        STEERING_SLIDE_RATE
      )
    : stopCarBodySlide(carBody)
  return finishSteering(request, slidBody, maximum, (limit) =>
    multiply(add(limit, magnitude), HALF)
  )
}

// 0x0041fee0: hands the driver's curvature to the car body (0x00446ef0), starting or ending slides.
export const applyDriverSteering = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  driven: DrivenCarBody
): DrivenCarBody => {
  const { multiply, storeFloat, getIsEqual, getIsBelow } = arithmetic
  const { driver, carBody } = driven
  if (getIsEqual(driver.curvature, 0) && getIsEqual(driver.previousCurvature, 0)) {
    return Object.freeze({
      driver: Object.freeze({ ...driver, previousCurvature: 0 }),
      carBody: stopCarBodySlide(setCarBodySteering(arithmetic, carBody, 0)),
    })
  }
  const curvature =
    !getIsEqual(driver.curvature, 0) && getIsBelow(carBody.rigidBody.speed, SLOW_SPEED)
      ? storeFloat(multiply(driver.curvature, SLOW_STEERING_SCALE))
      : driver.curvature
  const magnitude = getIsBelow(curvature, 0) ? -curvature : curvature
  const current = Object.freeze({ driver: Object.freeze({ ...driver, curvature }), carBody })
  if ((driver.flags & POWER_SLIDE_FLAG) !== 0) {
    return applyPowerSlideSteering({ arithmetic, tables, driven: current, curvature, magnitude })
  }
  if ((driver.flags & HOLD_FLAG) !== 0) return applyCurvature(arithmetic, current, curvature)
  return applyNormalSteering({ arithmetic, tables, driven: current, curvature, magnitude })
}

const getAppliedThrottle = (arithmetic: FloatArithmetic, driver: RacerDriver): number => {
  const { multiply, storeFloat } = arithmetic
  if ((driver.flags & FULL_THROTTLE_FLAG) !== 0) {
    return (driver.flags & TOUCHING_FULL_THROTTLE_FLAG) !== 0
      ? storeFloat(multiply(FULL_THROTTLE, HALF))
      : FULL_THROTTLE
  }
  if ((driver.flags & HOLD_FLAG) !== 0) {
    return storeFloat(multiply(driver.throttle, HOLD_THROTTLE_SCALE))
  }
  return driver.throttle
}

// 0x004201e0: hands the throttle to the car body (slot 5, 0x0042ad30); a slide boost multiplies it by 8.
export const applyDriverThrottle = (
  arithmetic: FloatArithmetic,
  driven: DrivenCarBody
): DrivenCarBody => {
  const { driver } = driven
  const isBoosted =
    (driver.flags & SLIDE_BOOST_FLAG) !== 0 && !arithmetic.getIsBelowOrEqual(driver.throttle, 0)
  const boosted = isBoosted
    ? Object.freeze({
        ...driver,
        throttle: arithmetic.storeFloat(
          arithmetic.multiply(driver.throttle, SLIDE_BOOST_MULTIPLIER)
        ),
      })
    : driver
  return Object.freeze({
    driver: boosted,
    carBody: setCarBodyThrottle(
      arithmetic,
      driven.carBody,
      getAppliedThrottle(arithmetic, boosted)
    ),
  })
}

// 0x004202c0.
export const stopDriverPowerSlide = (driven: DrivenCarBody): DrivenCarBody =>
  Object.freeze({
    driver: Object.freeze({
      ...driven.driver,
      flags: driven.driver.flags & ~(POWER_SLIDE_FLAG | SLIDE_BOOST_FLAG),
      slideMilliseconds: 0,
    }),
    carBody: stopCarBodyPowerSlide(stopCarBodySlide(driven.carBody)),
  })

// 0x00420260 (thiscall: direction, 1 when braking).
export const startDriverPowerSlide = (
  arithmetic: FloatArithmetic,
  driven: DrivenCarBody,
  direction: number
): DrivenCarBody => {
  const driver = Object.freeze({ ...driven.driver, flags: driven.driver.flags & ~SLIDE_BOOST_FLAG })
  if (!getIsCarBodyAbleToPowerSlide(arithmetic, driven.carBody)) {
    return Object.freeze({ driver, carBody: driven.carBody })
  }
  return Object.freeze({
    driver: Object.freeze({
      ...driver,
      slideMilliseconds: 0,
      flags: driver.flags | POWER_SLIDE_FLAG,
      slideDirection: direction,
    }),
    carBody: startCarBodyPowerSlide(
      driven.carBody,
      direction === 0 ? POWER_SLIDE_FACTOR : BRAKING_POWER_SLIDE_FACTOR
    ),
  })
}

const getWobble = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  driver: RacerDriver,
  randomPosition: RandomTablePosition
): DriverWobble => {
  const { subtract, multiply, storeFloat } = arithmetic
  const timer = drawRandomValue(tables.randomTable, randomPosition)
  const steering = drawRandomValue(tables.randomTable, timer.position)
  const throttle = drawRandomValue(tables.randomTable, steering.position)
  return Object.freeze({
    driver: Object.freeze({
      ...driver,
      wobbleMilliseconds: timer.value % 500,
      wobbleSteering: storeFloat(
        subtract(multiply(steering.value % 400, WOBBLE_STEP), WOBBLE_STEERING_OFFSET)
      ),
      wobbleThrottle: storeFloat(subtract(multiply(throttle.value % 200, WOBBLE_STEP), ONE)),
    }),
    randomPosition: throttle.position,
  })
}

// Without flag 0x10 a due wobble does nothing; otherwise the countdown runs (JBE at 0x0041fc1e).
const updateWobble = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  driver: RacerDriver,
  randomPosition: RandomTablePosition,
  stepMilliseconds: number
): DriverWobble => {
  if (stepMilliseconds <= driver.wobbleMilliseconds) {
    return Object.freeze({
      driver: Object.freeze({
        ...driver,
        wobbleMilliseconds: driver.wobbleMilliseconds - stepMilliseconds,
      }),
      randomPosition,
    })
  }
  if ((driver.flags & WOBBLE_FLAG) === 0) return Object.freeze({ driver, randomPosition })
  return getWobble(arithmetic, tables, driver, randomPosition)
}

const updateSlideTimers = (
  arithmetic: FloatArithmetic,
  driven: DrivenCarBody,
  stepMilliseconds: number
): DrivenCarBody => {
  const { driver, carBody } = driven
  if ((driver.flags & POWER_SLIDE_FLAG) !== 0) {
    if (arithmetic.getIsBelow(carBody.rigidBody.forwardSpeed, POWER_SLIDE_MINIMUM_FORWARD_SPEED)) {
      return stopDriverPowerSlide(driven)
    }
    const slideMilliseconds = toUnsigned(driver.slideMilliseconds + stepMilliseconds)
    return Object.freeze({ driver: Object.freeze({ ...driver, slideMilliseconds }), carBody })
  }
  if ((driver.flags & SLIDE_BOOST_FLAG) === 0) return driven
  const slideMilliseconds = toUnsigned(driver.slideMilliseconds + stepMilliseconds)
  const isOver = slideMilliseconds >= SLIDE_BOOST_MILLISECONDS
  return Object.freeze({
    driver: Object.freeze({
      ...driver,
      slideMilliseconds: isOver ? 0 : slideMilliseconds,
      flags: isOver ? driver.flags & ~SLIDE_BOOST_FLAG : driver.flags,
    }),
    carBody,
  })
}

// RacerDriver_Update 0x0041fc00 (thiscall: step): wobble, slide timers, then 0x0041fee0 and 0x004201e0.
export const updateRacerDriver = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  update: DriverUpdate,
  stepMilliseconds: number
): DriverUpdate => {
  const start = Object.freeze({
    ...update.driver,
    flags: update.driver.flags & ~HOLD_FLAG,
    previousCurvature: update.driver.curvature,
  })
  const { driver: wobbled, randomPosition } = updateWobble(
    arithmetic,
    tables,
    start,
    update.randomPosition,
    stepMilliseconds
  )
  const timed = updateSlideTimers(
    arithmetic,
    { driver: wobbled, carBody: update.carBody },
    stepMilliseconds
  )
  const isTouchingAtFullThrottle =
    (timed.driver.flags & FULL_THROTTLE_FLAG) !== 0 && timed.carBody.rigidBody.contactCount !== 0
  const flagged = isTouchingAtFullThrottle
    ? Object.freeze({
        driver: Object.freeze({
          ...timed.driver,
          flags: timed.driver.flags | TOUCHING_FULL_THROTTLE_FLAG,
        }),
        carBody: timed.carBody,
      })
    : timed
  const driven = applyDriverThrottle(arithmetic, applyDriverSteering(arithmetic, tables, flagged))
  return Object.freeze({ ...driven, randomPosition })
}

// 0x0041fd60, a driver with no route (figure +0x14 & 0x80): brake while moving forward, then steer and drive.
export const updateDriverWithoutRoute = (
  arithmetic: FloatArithmetic,
  tables: RacerTables,
  driven: DrivenCarBody
): DrivenCarBody => {
  const isMovingForward = !arithmetic.getIsBelowOrEqual(driven.carBody.rigidBody.forwardSpeed, 0)
  const throttle = isMovingForward
    ? arithmetic.storeFloat(-arithmetic.add(THROTTLE_FORCE, THROTTLE_FORCE))
    : 0
  const braked = Object.freeze({
    driver: Object.freeze({ ...driven.driver, throttle }),
    carBody: driven.carBody,
  })
  return applyDriverThrottle(arithmetic, applyDriverSteering(arithmetic, tables, braked))
}

// 0x0041fdb0 (thiscall: step): a car that stays below 0.009 in speed for a second starts reversing on the
// route for two seconds. A spinning car clears the reversing.
export const stepDriverStuckTimer = (
  arithmetic: FloatArithmetic,
  driven: DrivenCarBody,
  stepMilliseconds: number
): RacerDriver => {
  const { driver, carBody } = driven
  const stuckMilliseconds = toUnsigned(driver.stuckMilliseconds + stepMilliseconds)
  if ((carBody.rigidBody.flags & SPINNING_FLAG) !== 0) {
    return Object.freeze({
      ...driver,
      stuckMilliseconds: 0,
      flags: driver.flags & ~REVERSING_FLAG,
    })
  }
  if ((driver.flags & REVERSING_FLAG) !== 0) {
    return stuckMilliseconds < REVERSING_MILLISECONDS
      ? Object.freeze({ ...driver, stuckMilliseconds })
      : Object.freeze({ ...driver, stuckMilliseconds: 0, flags: driver.flags & ~REVERSING_FLAG })
  }
  const { forwardSpeed } = carBody.rigidBody
  const isMoving =
    !arithmetic.getIsBelowOrEqual(forwardSpeed, STUCK_SPEED) ||
    !arithmetic.getIsBelowOrEqual(-STUCK_SPEED, forwardSpeed)
  if (isMoving) return Object.freeze({ ...driver, stuckMilliseconds: 0 })
  return stuckMilliseconds < STUCK_MILLISECONDS
    ? Object.freeze({ ...driver, stuckMilliseconds })
    : Object.freeze({ ...driver, stuckMilliseconds: 0, flags: driver.flags | REVERSING_FLAG })
}

// The follower of 0x004202f0 and 0x004203b0 moves to the route's loop point and then ahead by the route step;
// the driver aims at where it ends up.
export const getDriverTargetAhead = (
  arithmetic: FloatArithmetic,
  driver: RacerDriver,
  route: ComputerRacerRoute,
  routeStepMilliseconds: number
): RacerDriver => {
  const started = setRouteFollowerSpeedFactor(
    startRouteFollowerAtLoop(arithmetic, driver.follower ?? createRouteFollower(route, ONE), route),
    ONE
  )
  const follower = advanceRouteFollower(
    arithmetic,
    started,
    arithmetic.storeFloat(routeStepMilliseconds)
  )
  return Object.freeze({
    ...driver,
    routeStepMilliseconds,
    follower,
    targetPosition: follower.position,
    targetRotation: follower.rotation,
  })
}

// 0x004202f0 (thiscall: route): the driver follows the route from now on. The route's follower is created here;
// the original has it from the racer's creation. Its speed factor is 1.0.
export const assignDriverRoute = (
  arithmetic: FloatArithmetic,
  driven: DrivenCarBody,
  route: ComputerRacerRoute
): DrivenCarBody => {
  const stopped = stopDriverPowerSlide(
    Object.freeze({
      driver: Object.freeze({
        ...driven.driver,
        routeStepMilliseconds: INITIAL_ROUTE_TARGET_MILLISECONDS,
        route,
        flags: driven.driver.flags | ON_ROUTE_FLAG,
      }),
      carBody: driven.carBody,
    })
  )
  const driver = getDriverTargetAhead(
    arithmetic,
    Object.freeze({ ...stopped.driver, curvature: 0 }),
    route,
    INITIAL_ROUTE_TARGET_MILLISECONDS
  )
  return Object.freeze({ driver, carBody: stopped.carBody })
}

// The target moves 250 ms further along the route (the update inside 0x004203b0).
export const advanceDriverTarget = (
  arithmetic: FloatArithmetic,
  driver: RacerDriver,
  route: ComputerRacerRoute
): RacerDriver =>
  getDriverTargetAhead(
    arithmetic,
    driver,
    route,
    toUnsigned(driver.routeStepMilliseconds + ROUTE_TARGET_STEP_MILLISECONDS)
  )

// 0x00420380: the car body has taken over the route; the driver lets go of it and of the steering and throttle.
export const releaseDriverRoute = (
  arithmetic: FloatArithmetic,
  driven: DrivenCarBody
): DrivenCarBody =>
  Object.freeze({
    driver: Object.freeze({
      ...driven.driver,
      route: null,
      flags: driven.driver.flags & ~ON_ROUTE_FLAG,
      routeStepMilliseconds: 0,
      curvature: 0,
      throttle: 0,
    }),
    carBody: setCarBodyThrottle(arithmetic, setCarBodySteering(arithmetic, driven.carBody, 0), 0),
  })

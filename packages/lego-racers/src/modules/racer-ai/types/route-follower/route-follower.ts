import type {
  ComputerRacerRoute,
  ComputerRacerRouteSample,
  Quaternion as RouteQuaternion,
  Vector3 as RouteVector,
} from '../../../computer-racer-route/index.ts'
import { getBlendedQuaternion, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Quaternion, Vector3 } from '../../../simulation-math/index.ts'
import { getFloatToInteger } from '../float-to-integer/float-to-integer.ts'
import { UnportableRouteError } from '../racer-ai-errors/racer-ai-errors.ts'
import type { RouteFollower } from '../racer-ai.types.ts'
import {
  getRouteSampleContactState,
  getRouteSampleDuration,
  getRouteSampleNegativeLateralLimit,
  getRouteSampleOffset,
  getRouteSamplePositiveLateralLimit,
  getRouteSampleRotation,
} from '../route-sample/route-sample.ts'

const ZERO_QUATERNION: Quaternion = Object.freeze({ x: 0, y: 0, z: 0, w: 0 })
const FIRST_ADVANCE_CONTACT_STATE = 4

const toVector = ([x, y, z]: RouteVector): Vector3 => Object.freeze({ x, y, z })

const toQuaternion = ([x, y, z, w]: RouteQuaternion): Quaternion => Object.freeze({ x, y, z, w })

const getSample = (route: ComputerRacerRoute, index: number): ComputerRacerRouteSample => {
  const sample = route.samples[index]
  if (sample === undefined) throw new UnportableRouteError(index)
  return sample
}

// FLD a; FADD b (or FSUB b); FSTP float, per component.
const getStoredSum = (arithmetic: FloatArithmetic, left: Vector3, right: Vector3): Vector3 =>
  Object.freeze({
    x: arithmetic.storeFloat(arithmetic.add(left.x, right.x)),
    y: arithmetic.storeFloat(arithmetic.add(left.y, right.y)),
    z: arithmetic.storeFloat(arithmetic.add(left.z, right.z)),
  })

const getStoredDifference = (arithmetic: FloatArithmetic, left: Vector3, right: Vector3): Vector3 =>
  Object.freeze({
    x: arithmetic.storeFloat(arithmetic.subtract(left.x, right.x)),
    y: arithmetic.storeFloat(arithmetic.subtract(left.y, right.y)),
    z: arithmetic.storeFloat(arithmetic.subtract(left.z, right.z)),
  })

// The fields the reset leaves alone are written by the first advance before anything reads them.
export const createRouteFollower = (
  route: ComputerRacerRoute | null,
  speedFactor: number
): RouteFollower =>
  Object.freeze({
    route,
    position: ZERO_VECTOR3,
    rotation: ZERO_QUATERNION,
    contactState: 0,
    negativeLateralLimit: 0,
    positiveLateralLimit: 0,
    speedFactor,
    time: 0,
    previousSampleIndex: -1,
    nextSampleIndex: 0,
    previousPosition: ZERO_VECTOR3,
    nextPosition: ZERO_VECTOR3,
    previousRotation: ZERO_QUATERNION,
    nextRotation: ZERO_QUATERNION,
    previousTime: 0,
  })

// 0x004a5200 (thiscall: route): restart before the first sample.
export const resetRouteFollower = (
  follower: RouteFollower,
  route: ComputerRacerRoute | null
): RouteFollower =>
  Object.freeze({
    ...follower,
    route,
    previousSampleIndex: -1,
    time: 0,
    nextSampleIndex: 0,
    previousTime: 0,
  })

export const setRouteFollowerSpeedFactor = (
  follower: RouteFollower,
  speedFactor: number
): RouteFollower => Object.freeze({ ...follower, speedFactor })

// 0x004a5220 (thiscall: route): jump to the route's loop point (+0x24..+0x44). The next rotation is not
// reloaded: it keeps whatever the follower held, exactly as the original.
export const startRouteFollowerAtLoop = (
  arithmetic: FloatArithmetic,
  follower: RouteFollower,
  route: ComputerRacerRoute
): RouteFollower => {
  const loopPosition = toVector(route.secondVector)
  const loopRotation = toQuaternion(route.secondQuaternion)
  const previousSample = getSample(route, route.sampleIndex)
  const nextSampleIndex = route.sampleIndex + 1
  const nextSample = getSample(route, nextSampleIndex)
  return Object.freeze({
    ...follower,
    route,
    position: loopPosition,
    rotation: loopRotation,
    previousPosition: loopPosition,
    previousRotation: loopRotation,
    previousTime: route.firstInteger,
    time: arithmetic.storeFloat(route.firstInteger),
    previousSampleIndex: route.sampleIndex,
    nextSampleIndex,
    contactState: getRouteSampleContactState(previousSample),
    negativeLateralLimit: arithmetic.storeFloat(
      getRouteSampleNegativeLateralLimit(arithmetic, previousSample)
    ),
    positiveLateralLimit: arithmetic.storeFloat(
      getRouteSamplePositiveLateralLimit(arithmetic, previousSample)
    ),
    nextPosition: getStoredSum(
      arithmetic,
      getRouteSampleOffset(arithmetic, nextSample),
      loopPosition
    ),
  })
}

// 0x004a5320 (thiscall: float step): advance the playback time by speedFactor * step milliseconds and
// interpolate position, rotation and lateral limits between the two samples around it.
export const advanceRouteFollower = (
  arithmetic: FloatArithmetic,
  follower: RouteFollower,
  stepMilliseconds: number
): RouteFollower => {
  const { route } = follower
  if (route === null) return follower
  const { add, subtract, multiply, divide, storeFloat } = arithmetic
  const unroundedTime = add(multiply(follower.speedFactor, stepMilliseconds), follower.time)
  let time = storeFloat(unroundedTime)
  let target = getFloatToInteger(unroundedTime)
  let { previousSampleIndex, nextSampleIndex, previousTime, contactState } = follower
  let { previousPosition, nextPosition, previousRotation, nextRotation } = follower
  let previousNegativeLimit: number
  let previousPositiveLimit: number
  let nextSample: ComputerRacerRouteSample
  if (previousSampleIndex < 0) {
    previousNegativeLimit = 0
    previousPositiveLimit = 0
    previousPosition = toVector(route.firstVector)
    previousRotation = toQuaternion(route.firstQuaternion)
    previousTime = 0
    nextSample = getSample(route, nextSampleIndex)
    nextPosition = getStoredSum(
      arithmetic,
      getRouteSampleOffset(arithmetic, nextSample),
      previousPosition
    )
    nextRotation = getRouteSampleRotation(arithmetic, nextSample)
    contactState = FIRST_ADVANCE_CONTACT_STATE
  } else {
    const previousSample = getSample(route, previousSampleIndex)
    previousPositiveLimit = storeFloat(
      getRouteSamplePositiveLateralLimit(arithmetic, previousSample)
    )
    previousNegativeLimit = storeFloat(
      getRouteSampleNegativeLateralLimit(arithmetic, previousSample)
    )
    nextSample = getSample(route, nextSampleIndex)
  }
  let nextPositiveLimit = storeFloat(getRouteSamplePositiveLateralLimit(arithmetic, nextSample))
  let nextNegativeLimit = storeFloat(getRouteSampleNegativeLateralLimit(arithmetic, nextSample))
  let nextTime = getRouteSampleDuration(nextSample) + previousTime
  if (target < previousTime) {
    // 0x004a5446: step back while the target lies before the previous sample.
    let isBeforeStart = previousSampleIndex === 0
    while (!isBeforeStart) {
      nextTime = previousTime
      nextSampleIndex = previousSampleIndex
      nextPosition = previousPosition
      nextRotation = previousRotation
      nextPositiveLimit = previousPositiveLimit
      nextNegativeLimit = previousNegativeLimit
      const leavingSample = getSample(route, previousSampleIndex)
      previousPosition = getStoredDifference(
        arithmetic,
        previousPosition,
        getRouteSampleOffset(arithmetic, leavingSample)
      )
      previousTime -= getRouteSampleDuration(leavingSample)
      previousSampleIndex -= 1
      const enteringSample = getSample(route, previousSampleIndex)
      contactState = getRouteSampleContactState(enteringSample)
      previousPositiveLimit = storeFloat(
        getRouteSamplePositiveLateralLimit(arithmetic, enteringSample)
      )
      previousNegativeLimit = storeFloat(
        getRouteSampleNegativeLateralLimit(arithmetic, enteringSample)
      )
      previousRotation = getRouteSampleRotation(arithmetic, enteringSample)
      if (target >= previousTime) break
      isBeforeStart = previousSampleIndex === 0
    }
    if (isBeforeStart) {
      target = 0
      time = 0
    }
  } else {
    // 0x004a5547: step forward while the target lies at or after the next sample.
    while (target >= nextTime) {
      previousTime = nextTime
      previousSampleIndex = nextSampleIndex
      previousPosition = nextPosition
      previousRotation = nextRotation
      previousPositiveLimit = nextPositiveLimit
      previousNegativeLimit = nextNegativeLimit
      nextSampleIndex += 1
      if (nextSampleIndex >= route.samples.length) {
        // 0x004a55ab: wrap to the loop point. The running next time is not reset, as in the original.
        previousPosition = toVector(route.secondVector)
        nextPosition = previousPosition
        previousRotation = toQuaternion(route.secondQuaternion)
        previousTime = route.firstInteger
        previousSampleIndex = route.sampleIndex
        target += route.firstInteger - nextTime
        nextSampleIndex = previousSampleIndex + 1
        time = storeFloat(target)
      }
      const enteringSample = getSample(route, nextSampleIndex)
      contactState = getRouteSampleContactState(enteringSample)
      nextPositiveLimit = storeFloat(getRouteSamplePositiveLateralLimit(arithmetic, enteringSample))
      nextNegativeLimit = storeFloat(getRouteSampleNegativeLateralLimit(arithmetic, enteringSample))
      const offset = getRouteSampleOffset(arithmetic, enteringSample)
      nextRotation = getRouteSampleRotation(arithmetic, enteringSample)
      nextPosition = getStoredSum(arithmetic, offset, nextPosition)
      nextTime += getRouteSampleDuration(enteringSample)
    }
  }
  // 0x004a568e: FILD (target - previous); FILD (next - previous); FDIVP; FSTP float.
  const fraction = storeFloat(divide(target - previousTime, nextTime - previousTime))
  const interpolate = (start: number, end: number): number =>
    storeFloat(add(multiply(subtract(end, start), fraction), start))
  const delta = getStoredDifference(arithmetic, nextPosition, previousPosition)
  // The x product stays on the FPU stack; the y and z products are stored first.
  const position = Object.freeze({
    x: storeFloat(add(multiply(delta.x, fraction), previousPosition.x)),
    y: storeFloat(add(storeFloat(multiply(delta.y, fraction)), previousPosition.y)),
    z: storeFloat(add(storeFloat(multiply(delta.z, fraction)), previousPosition.z)),
  })
  return Object.freeze({
    ...follower,
    time,
    previousSampleIndex,
    nextSampleIndex,
    previousTime,
    contactState,
    previousPosition,
    nextPosition,
    previousRotation,
    nextRotation,
    negativeLateralLimit: interpolate(previousNegativeLimit, nextNegativeLimit),
    positiveLateralLimit: interpolate(previousPositiveLimit, nextPositiveLimit),
    position,
    rotation: getBlendedQuaternion(arithmetic, previousRotation, nextRotation, fraction),
  })
}

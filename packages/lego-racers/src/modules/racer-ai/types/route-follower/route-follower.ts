import type {
  ComputerRacerRoute,
  ComputerRacerRouteSample,
  Quaternion as RouteQuaternion,
  Vector3 as RouteVector,
} from '../../../computer-racer-route/index.ts'
import {
  getBlendedQuaternion,
  getDotProduct,
  getSquaredLength,
  getStoredDifference,
  getStoredSum,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Quaternion, Vector3 } from '../../../simulation-math/index.ts'
import { getFloatToInteger } from '../float-to-integer/float-to-integer.ts'
import { UnportableRouteError } from '../racer-ai-errors/racer-ai-errors.ts'
import type { RouteFollower, RouteSegment } from '../racer-ai.types.ts'
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
const SEGMENT_EPSILON = Math.fround(0.001) // 0x004b4bc8
const ONE = 1

const toVector = ([x, y, z]: RouteVector): Vector3 => Object.freeze({ x, y, z })

const toQuaternion = ([x, y, z, w]: RouteQuaternion): Quaternion => Object.freeze({ x, y, z, w })

const getSample = (route: ComputerRacerRoute, index: number): ComputerRacerRouteSample => {
  const sample = route.samples[index]
  if (sample === undefined) throw new UnportableRouteError(index)
  return sample
}

// getStoredSum and getStoredDifference (simulation-math): FLD a; FADD b (or FSUB b); FSTP float, per component.

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

const getUnstoredDifference = (
  arithmetic: FloatArithmetic,
  left: Vector3,
  right: Vector3
): Vector3 => ({
  x: arithmetic.subtract(left.x, right.x),
  y: arithmetic.subtract(left.y, right.y),
  z: arithmetic.subtract(left.z, right.z),
})

// 0x004a5750, the first loop: samples whose segment is shorter than 0.001 are skipped. Null when the route ends.
const getFirstUsableSegment = (
  arithmetic: FloatArithmetic,
  follower: RouteFollower,
  route: ComputerRacerRoute
): RouteSegment | null => {
  let segment: RouteSegment = {
    previousSampleIndex: follower.previousSampleIndex,
    nextSampleIndex: follower.nextSampleIndex,
    previousTime: follower.previousTime,
    nextTime:
      getRouteSampleDuration(getSample(route, follower.nextSampleIndex)) + follower.previousTime,
    previousPosition: follower.previousPosition,
    nextPosition: follower.nextPosition,
  }
  const getIsShort = (): boolean =>
    arithmetic.getIsBelow(
      getSquaredLength(
        arithmetic,
        getUnstoredDifference(arithmetic, segment.previousPosition, segment.nextPosition)
      ),
      SEGMENT_EPSILON
    )
  while (getIsShort()) {
    const nextSampleIndex = segment.nextSampleIndex + 1
    if (nextSampleIndex >= route.samples.length) return null
    const enteringSample = getSample(route, nextSampleIndex)
    segment = {
      previousSampleIndex: segment.nextSampleIndex,
      nextSampleIndex,
      previousTime: segment.nextTime,
      nextTime: segment.nextTime + getRouteSampleDuration(enteringSample),
      previousPosition: segment.nextPosition,
      nextPosition: getStoredSum(
        arithmetic,
        getRouteSampleOffset(arithmetic, enteringSample),
        segment.nextPosition
      ),
    }
  }
  return segment
}

// 0x004a5750 (thiscall: displacement): moves the follower along the route by the part of the displacement along
// the current segment, then advances by 0 ms (0x004a5320). Only the case where the move ends inside the segment
// is ported (a zero displacement, as 0x0042b0c0 passes, always is); moving past either end of the segment
// (0x004a5bc6, 0x004a59ab) is refused.
export const moveRouteFollower = (
  arithmetic: FloatArithmetic,
  follower: RouteFollower,
  displacement: Vector3
): RouteFollower => {
  const { route } = follower
  if (route === null) return follower
  const {
    add,
    subtract,
    multiply,
    divide,
    getSquareRoot,
    storeFloat,
    getIsBelow,
    getIsBelowOrEqual,
  } = arithmetic
  const segment = getFirstUsableSegment(arithmetic, follower, route)
  if (segment === null) return follower
  const { previousPosition, nextPosition } = segment
  const directionX = subtract(nextPosition.x, previousPosition.x)
  const directionY = storeFloat(subtract(nextPosition.y, previousPosition.y))
  const directionZ = subtract(nextPosition.z, previousPosition.z)
  const storedDirectionZ = storeFloat(directionZ)
  const length = storeFloat(
    getSquareRoot(
      add(
        add(multiply(directionZ, storedDirectionZ), multiply(directionY, directionY)),
        multiply(directionX, directionX)
      )
    )
  )
  const inverseLength = storeFloat(divide(ONE, length))
  const unit: Vector3 = {
    x: storeFloat(multiply(directionX, inverseLength)),
    y: storeFloat(multiply(directionY, inverseLength)),
    z: storeFloat(multiply(storedDirectionZ, inverseLength)),
  }
  const alongRaw = getDotProduct(arithmetic, unit, displacement)
  const distanceToNext = getSquareRoot(
    getSquaredLength(arithmetic, getUnstoredDifference(arithmetic, follower.position, nextPosition))
  )
  const along = storeFloat(alongRaw)
  if (getIsBelow(alongRaw, 0) || !getIsBelowOrEqual(along, distanceToNext)) {
    throw new UnportableRouteError(segment.nextSampleIndex)
  }
  const travelled = subtract(add(along, length), distanceToNext)
  const duration = segment.nextTime - segment.previousTime
  const time = storeFloat(
    add(multiply(duration, multiply(travelled, inverseLength)), segment.previousTime)
  )
  return advanceRouteFollower(
    arithmetic,
    Object.freeze({
      ...follower,
      time,
      previousTime: segment.previousTime,
      previousPosition,
      nextPosition,
      previousSampleIndex: segment.previousSampleIndex,
      nextSampleIndex: segment.nextSampleIndex,
      previousRotation: getRouteSampleRotation(
        arithmetic,
        getSample(route, segment.previousSampleIndex)
      ),
      nextRotation: getRouteSampleRotation(arithmetic, getSample(route, segment.nextSampleIndex)),
    }),
    0
  )
}

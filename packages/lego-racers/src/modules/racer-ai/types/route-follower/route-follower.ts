import type {
  ComputerRacerRoute,
  ComputerRacerRouteSample,
  Quaternion as RouteQuaternion,
  Vector3 as RouteVector,
} from '../../../computer-racer-route/index.ts'
import {
  getBlendedQuaternion,
  getSquaredLength,
  getStoredDifference,
  getStoredSum,
  getUnstoredDifference,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Quaternion, Vector3 } from '../../../simulation-math/index.ts'
import { getFloatToInteger } from '../float-to-integer/float-to-integer.ts'
import { UnportableRouteError } from '../racer-ai-errors/racer-ai-errors.ts'
import type {
  RouteFollower,
  RouteFollowerMove,
  RouteSegment,
  SegmentGeometry,
  SegmentMove,
} from '../racer-ai.types.ts'
import {
  getRouteSampleContactState,
  getRouteSampleDuration,
  getRouteSampleNegativeLateralLimit,
  getRouteSampleOffset,
  getRouteSamplePositiveLateralLimit,
  getRouteSampleRotation,
} from '../route-sample/route-sample.ts'

const IDENTITY_QUATERNION: Quaternion = Object.freeze({ x: 0, y: 0, z: 0, w: 1 })
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

// 0x004a5190: the constructor leaves the three rotations at the identity and the speed factor at 1.0.
export const createRouteFollower = (
  route: ComputerRacerRoute | null,
  speedFactor: number
): RouteFollower =>
  Object.freeze({
    route,
    position: ZERO_VECTOR3,
    rotation: IDENTITY_QUATERNION,
    contactState: 0,
    negativeLateralLimit: 0,
    positiveLateralLimit: 0,
    speedFactor,
    time: 0,
    previousSampleIndex: -1,
    nextSampleIndex: 0,
    previousPosition: ZERO_VECTOR3,
    nextPosition: ZERO_VECTOR3,
    previousRotation: IDENTITY_QUATERNION,
    nextRotation: IDENTITY_QUATERNION,
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

const getIsShortSegment = (arithmetic: FloatArithmetic, segment: RouteSegment): boolean =>
  arithmetic.getIsBelow(
    getSquaredLength(
      arithmetic,
      getUnstoredDifference(arithmetic, segment.previousPosition, segment.nextPosition)
    ),
    SEGMENT_EPSILON
  )

// 0x004a57fc..0x004a58b0 and 0x004a5bf3..0x004a5cc1: the segment moves one sample forward (the next sample becomes the
// previous one, a new next position is the old one plus the entering sample's offset). Null when the route ends.
const getSegmentAfter = (
  arithmetic: FloatArithmetic,
  route: ComputerRacerRoute,
  segment: RouteSegment
): RouteSegment | null => {
  const nextSampleIndex = segment.nextSampleIndex + 1
  if (nextSampleIndex >= route.samples.length) return null
  const enteringSample = getSample(route, nextSampleIndex)
  return {
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

// 0x004a59ee..0x004a5aae: the segment moves one sample back (the previous sample becomes the next one; the previous
// position is the old one minus the leaving sample's offset, the previous time the old one minus its duration).
// Null when there is no sample before.
const getSegmentBefore = (
  arithmetic: FloatArithmetic,
  route: ComputerRacerRoute,
  segment: RouteSegment
): RouteSegment | null => {
  const previousSampleIndex = segment.previousSampleIndex - 1
  if (previousSampleIndex < 0) return null
  const leavingSample = getSample(route, segment.previousSampleIndex)
  return {
    previousSampleIndex,
    nextSampleIndex: segment.previousSampleIndex,
    previousTime: segment.previousTime - getRouteSampleDuration(leavingSample),
    nextTime: segment.previousTime,
    previousPosition: getStoredDifference(
      arithmetic,
      segment.previousPosition,
      getRouteSampleOffset(arithmetic, leavingSample)
    ),
    nextPosition: segment.previousPosition,
  }
}

// The segments are searched for one at least 0.001 long: 0x004a5750's first loop, and the loops after a move across a
// sample boundary.
const getUsableSegment = (
  arithmetic: FloatArithmetic,
  first: RouteSegment | null,
  getNext: (segment: RouteSegment) => RouteSegment | null
): RouteSegment | null => {
  let segment = first
  while (segment !== null && getIsShortSegment(arithmetic, segment)) segment = getNext(segment)
  return segment
}

// The segment's length (stored; the square root still on the stack is `unroundedLength`), its reciprocal and the unit
// direction, every component stored (0x004a58b6..0x004a5932).
const getSegmentGeometry = (
  arithmetic: FloatArithmetic,
  segment: RouteSegment
): SegmentGeometry => {
  const { add, multiply, divide, getSquareRoot, storeFloat } = arithmetic
  const { previousPosition, nextPosition } = segment
  const directionX = arithmetic.subtract(nextPosition.x, previousPosition.x)
  const directionY = storeFloat(arithmetic.subtract(nextPosition.y, previousPosition.y))
  const directionZ = arithmetic.subtract(nextPosition.z, previousPosition.z)
  const storedDirectionZ = storeFloat(directionZ)
  const unroundedLength = getSquareRoot(
    add(
      add(multiply(directionZ, storedDirectionZ), multiply(directionY, directionY)),
      multiply(directionX, directionX)
    )
  )
  const length = storeFloat(unroundedLength)
  const inverseLength = storeFloat(divide(ONE, length))
  return {
    unroundedLength,
    length,
    inverseLength,
    unit: {
      x: storeFloat(multiply(directionX, inverseLength)),
      y: storeFloat(multiply(directionY, inverseLength)),
      z: storeFloat(multiply(storedDirectionZ, inverseLength)),
    },
  }
}

// The part of the displacement along the segment: (y + z) + x, left on the FPU stack.
const getAlongSegment = (
  arithmetic: FloatArithmetic,
  geometry: SegmentGeometry,
  displacement: Vector3
): number => {
  const { add, multiply } = arithmetic
  const { unit } = geometry
  return add(
    add(multiply(unit.y, displacement.y), multiply(displacement.z, unit.z)),
    multiply(unit.x, displacement.x)
  )
}

// 0x00404580 (displacement, unit · distance, displacement): the displacement minus the way travelled along the
// segment, each component stored (the product by the distance is stored first).
const getDisplacementAfter = (
  arithmetic: FloatArithmetic,
  displacement: Vector3,
  unit: Vector3,
  distance: number
): Vector3 => {
  const { subtract, multiply, storeFloat } = arithmetic
  return Object.freeze({
    x: storeFloat(subtract(displacement.x, storeFloat(multiply(unit.x, distance)))),
    y: storeFloat(subtract(displacement.y, storeFloat(multiply(unit.y, distance)))),
    z: storeFloat(subtract(displacement.z, storeFloat(multiply(unit.z, distance)))),
  })
}

// The distance from the follower to the segment's end (forward) or start (backward), summed as (z² + y²) + x².
const getDistanceTo = (arithmetic: FloatArithmetic, from: Vector3, to: Vector3): number =>
  arithmetic.getSquareRoot(
    getSquaredLength(arithmetic, getUnstoredDifference(arithmetic, from, to))
  )

// 0x004a5750, a displacement along the route's direction: the part of the displacement along the segment moves the
// follower; when it reaches the segment's end the rest continues along the next segments (0x004a5bc6), taking each
// whole length off the displacement. Returns the segment the follower ends in, the distance into it, and the
// displacement that is left; null segment when the route ends first.
const moveForward = (
  arithmetic: FloatArithmetic,
  route: ComputerRacerRoute,
  follower: RouteFollower,
  first: RouteSegment,
  displacement: Vector3
): SegmentMove => {
  const { add, subtract, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const geometry = getSegmentGeometry(arithmetic, first)
  const along = storeFloat(getAlongSegment(arithmetic, geometry, displacement))
  const distanceToNext = getDistanceTo(arithmetic, follower.position, first.nextPosition)
  if (getIsBelowOrEqual(along, distanceToNext)) {
    return {
      segment: first,
      geometry,
      distance: subtract(add(along, geometry.length), distanceToNext),
      displacement,
    }
  }
  let current = first
  let remaining = getDisplacementAfter(arithmetic, displacement, geometry.unit, distanceToNext)
  for (;;) {
    const next = getUsableSegment(
      arithmetic,
      getSegmentAfter(arithmetic, route, current),
      (segment) => getSegmentAfter(arithmetic, route, segment)
    )
    if (next === null) return { segment: null, geometry, distance: 0, displacement: remaining }
    current = next
    const currentGeometry = getSegmentGeometry(arithmetic, current)
    const alongRaw = getAlongSegment(arithmetic, currentGeometry, remaining)
    if (getIsBelow(alongRaw, 0)) {
      return {
        segment: current,
        geometry: currentGeometry,
        distance: subtract(add(0, currentGeometry.length), currentGeometry.unroundedLength),
        displacement: remaining,
      }
    }
    if (getIsBelowOrEqual(alongRaw, currentGeometry.length)) {
      return {
        segment: current,
        geometry: currentGeometry,
        distance: subtract(add(alongRaw, currentGeometry.length), currentGeometry.unroundedLength),
        displacement: remaining,
      }
    }
    remaining = getDisplacementAfter(
      arithmetic,
      remaining,
      currentGeometry.unit,
      currentGeometry.unroundedLength
    )
  }
}

// 0x004a595f: the same going back. A displacement with a negative part along the segment moves the follower toward
// the segment's start and, when it passes it, on through the earlier segments; a later segment that the rest points
// forward in ends the move at that segment's end.
const moveBackward = (
  arithmetic: FloatArithmetic,
  route: ComputerRacerRoute,
  follower: RouteFollower,
  first: RouteSegment,
  displacement: Vector3
): SegmentMove => {
  const { subtract, storeFloat, getIsBelowOrEqual, getIsBelow } = arithmetic
  const geometry = getSegmentGeometry(arithmetic, first)
  const along = storeFloat(-getAlongSegment(arithmetic, geometry, displacement))
  const distanceToPrevious = getDistanceTo(arithmetic, follower.position, first.previousPosition)
  if (getIsBelowOrEqual(along, distanceToPrevious)) {
    return {
      segment: first,
      geometry,
      distance: subtract(distanceToPrevious, along),
      displacement,
    }
  }
  let current = first
  let remaining = getDisplacementAfter(arithmetic, displacement, geometry.unit, -distanceToPrevious)
  for (;;) {
    const previous = getUsableSegment(
      arithmetic,
      getSegmentBefore(arithmetic, route, current),
      (segment) => getSegmentBefore(arithmetic, route, segment)
    )
    if (previous === null) return { segment: null, geometry, distance: 0, displacement: remaining }
    current = previous
    const currentGeometry = getSegmentGeometry(arithmetic, current)
    const alongRaw = getAlongSegment(arithmetic, currentGeometry, remaining)
    if (getIsBelow(0, alongRaw)) {
      return {
        segment: current,
        geometry: currentGeometry,
        distance: subtract(currentGeometry.unroundedLength, 0),
        displacement: remaining,
      }
    }
    const behind = -alongRaw
    if (getIsBelowOrEqual(behind, currentGeometry.length)) {
      return {
        segment: current,
        geometry: currentGeometry,
        distance: subtract(currentGeometry.unroundedLength, behind),
        displacement: remaining,
      }
    }
    remaining = getDisplacementAfter(
      arithmetic,
      remaining,
      currentGeometry.unit,
      -currentGeometry.unroundedLength
    )
  }
}

// 0x004a5750 (thiscall: displacement): the follower is moved along its route by a displacement (the displacement is
// shortened by the way it went, and returned), and then advanced by 0 ms (0x004a5320). A route that ends before the
// move is finished leaves the follower as it was.
export const moveRouteFollower = (
  arithmetic: FloatArithmetic,
  follower: RouteFollower,
  displacement: Vector3
): RouteFollowerMove => {
  const { route } = follower
  if (route === null) return { follower, displacement }
  const { add, multiply, storeFloat, getIsBelow } = arithmetic
  const first = getUsableSegment(
    arithmetic,
    {
      previousSampleIndex: follower.previousSampleIndex,
      nextSampleIndex: follower.nextSampleIndex,
      previousTime: follower.previousTime,
      nextTime:
        getRouteSampleDuration(getSample(route, follower.nextSampleIndex)) + follower.previousTime,
      previousPosition: follower.previousPosition,
      nextPosition: follower.nextPosition,
    },
    (segment) => getSegmentAfter(arithmetic, route, segment)
  )
  if (first === null) return { follower, displacement }
  const alongRaw = getAlongSegment(arithmetic, getSegmentGeometry(arithmetic, first), displacement)
  const move = getIsBelow(alongRaw, 0)
    ? moveBackward(arithmetic, route, follower, first, displacement)
    : moveForward(arithmetic, route, follower, first, displacement)
  const { segment } = move
  if (segment === null) return { follower, displacement: move.displacement }
  const duration = segment.nextTime - segment.previousTime
  const time = storeFloat(
    add(
      multiply(duration, multiply(move.distance, move.geometry.inverseLength)),
      segment.previousTime
    )
  )
  return {
    displacement: move.displacement,
    follower: advanceRouteFollower(
      arithmetic,
      Object.freeze({
        ...follower,
        time,
        previousTime: segment.previousTime,
        previousPosition: segment.previousPosition,
        nextPosition: segment.nextPosition,
        previousSampleIndex: segment.previousSampleIndex,
        nextSampleIndex: segment.nextSampleIndex,
        previousRotation: getRouteSampleRotation(
          arithmetic,
          getSample(route, segment.previousSampleIndex)
        ),
        nextRotation: getRouteSampleRotation(arithmetic, getSample(route, segment.nextSampleIndex)),
      }),
      0
    ),
  }
}

import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import { advanceRouteFollower } from '../../../racer-ai/index.ts'
import {
  getDotProduct,
  getFloatFromBits,
  getMatrixFromQuaternion,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import {
  placeCarBodyAtRouteLoop,
  resetCarBodyRoute,
} from '../../types/car-body-commands/car-body-commands.ts'
import {
  advanceDriverTarget,
  applyDriverSteering,
  applyDriverThrottle,
  releaseDriverRoute,
  stepDriverStuckTimer,
} from '../../types/racer-driver/racer-driver.ts'
import { getDriven, getRacer, setDriven, setRacer } from '../../types/racer-state/racer-state.ts'
import type {
  CarBody,
  DrivenCarBody,
  RacerBoundary,
  RacerDriver,
  RacerSetContext,
} from '../../types/racer.types.ts'

const TAKEOVER_DISTANCE = getFloatFromBits(0x40400000) // 0x004b0088, 3
const MINIMUM_PROJECTION = getFloatFromBits(0x3a03126f) // 0x004b0078, 0.0005
const STRAIGHT_CURVATURE = getFloatFromBits(0x45800000) // 0x004b0058, 4096
const ROUTE_THROTTLE = getFloatFromBits(0x41900000) // 0x004b0094, 18
const REVERSING_THROTTLE = getFloatFromBits(0x42580000) // 0x004b0064, 54
const NEAR_DISTANCE = getFloatFromBits(0x41f00000) // 0x004b008c, 30
const FAR_DISTANCE = getFloatFromBits(0x42a00000) // 0x004b0090, 80
const MINIMUM_ALIGNMENT = 0.5 // 0x004af58c
const ONE = 1
const REVERSING_FLAG = 0x20
const GROUNDED_WHEEL_MINIMUM = 3

type TargetOffset = {
  readonly offset: Vector3
  readonly distanceRaw: number
  readonly distance: number
}

// The vector from the car to the target: float32 differences, the length a stored square root. The z term
// multiplies the unstored difference by its stored copy (FST, FMUL float ptr).
const getTargetOffset = (
  arithmetic: FloatArithmetic,
  driver: RacerDriver,
  car: CarBody
): TargetOffset => {
  const { add, subtract, multiply, getSquareRoot, storeFloat } = arithmetic
  const { position } = car.rigidBody.displayFrame
  const { targetPosition } = driver
  const differenceZ = subtract(targetPosition.z, position.z)
  const offset: Vector3 = Object.freeze({
    x: storeFloat(subtract(targetPosition.x, position.x)),
    y: storeFloat(subtract(targetPosition.y, position.y)),
    z: storeFloat(differenceZ),
  })
  const distanceRaw = getSquareRoot(
    add(
      add(multiply(differenceZ, offset.z), multiply(offset.y, offset.y)),
      multiply(offset.x, offset.x)
    )
  )
  return Object.freeze({ offset, distanceRaw, distance: storeFloat(distanceRaw) })
}

const getHeading = (car: CarBody): Vector3 => {
  const { rigidBody } = car
  if (rigidBody.groundedWheelCount < GROUNDED_WHEEL_MINIMUM) return rigidBody.heading
  const { rotation } = rigidBody.displayFrame
  return Object.freeze({ x: rotation[0], y: rotation[1], z: rotation[2] })
}

// 0x004203b0 from the stored vector on: the curvature that bends the car's second axis onto the target.
const getRouteCurvature = (
  arithmetic: FloatArithmetic,
  car: CarBody,
  target: TargetOffset
): number => {
  const { add, multiply, divide, storeFloat, getIsBelow } = arithmetic
  const { offset, distance } = target
  const { rotation } = car.rigidBody.displayFrame
  const side: Vector3 = Object.freeze({ x: rotation[3], y: rotation[4], z: rotation[5] })
  const isTargetBehind = getIsBelow(getDotProduct(arithmetic, side, offset), 0)
  const sign = isTargetBehind ? -1 : 1
  const inverseDistance = divide(ONE, distance)
  const scaledX = storeFloat(multiply(inverseDistance, offset.x))
  const scaledY = storeFloat(multiply(inverseDistance, offset.y))
  const scaledZ = multiply(inverseDistance, offset.z)
  const projection = add(
    add(multiply(sign * side.z, scaledZ), multiply(sign * side.y, scaledY)),
    multiply(sign * side.x, scaledX)
  )
  const curvature = getIsBelow(projection, MINIMUM_PROJECTION)
    ? STRAIGHT_CURVATURE
    : storeFloat(divide(distance, add(projection, projection)))
  return isTargetBehind ? -curvature : curvature
}

const getIsMisaligned = (
  arithmetic: FloatArithmetic,
  driver: RacerDriver,
  car: CarBody
): boolean => {
  const forward = getMatrixFromQuaternion(arithmetic, driver.targetRotation)
  const heading = getHeading(car)
  return arithmetic.getIsBelow(
    getDotProduct(arithmetic, heading, { x: forward[0], y: forward[1], z: forward[2] }),
    MINIMUM_ALIGNMENT
  )
}

const steerTowardsTarget = (
  context: RacerSetContext,
  driven: DrivenCarBody,
  route: ComputerRacerRoute,
  target: TargetOffset
): DrivenCarBody => {
  const { arithmetic } = context
  const { carBody } = driven
  const isReversing = (driven.driver.flags & REVERSING_FLAG) !== 0
  const curvature = getRouteCurvature(arithmetic, carBody, target)
  const aimed = Object.freeze({
    ...driven.driver,
    previousCurvature: driven.driver.curvature,
    curvature: isReversing ? -curvature : curvature,
    throttle: isReversing ? -REVERSING_THROTTLE : ROUTE_THROTTLE,
  })
  const isCloseEnough =
    arithmetic.getIsBelow(target.distance, NEAR_DISTANCE) ||
    getIsMisaligned(arithmetic, aimed, carBody)
  const targeted =
    isCloseEnough && arithmetic.getIsBelowOrEqual(target.distance, FAR_DISTANCE)
      ? advanceDriverTarget(arithmetic, aimed, route)
      : aimed
  return Object.freeze({ driver: targeted, carBody })
}

// 0x004203b0 (thiscall: step), pass 1 for a computer racer on a route (driver flag 0x40). Within 3 units of its
// target the car body takes over the route (0x0042a730, 0x0042b0c0, 0x00420380). Further away the driver steers
// towards the target, 250 ms further along the route each time the car is close or turned away from it, and
// reverses for two seconds after standing still for one.
export const followDriverRoute: RacerBoundary = (
  context,
  racerSet,
  racerIndex,
  stepMilliseconds
) => {
  const { arithmetic, tables } = context
  const racer = getRacer(racerSet, racerIndex)
  const { route, follower } = racer.driver
  if (route === null || follower === null) return racerSet
  const targetOffset = getTargetOffset(arithmetic, racer.driver, racer.carBody)
  if (arithmetic.getIsBelow(targetOffset.distanceRaw, TAKEOVER_DISTANCE)) {
    const placed = resetCarBodyRoute(
      arithmetic,
      placeCarBodyAtRouteLoop(arithmetic, racer.carBody, route)
    )
    const advanced = Object.freeze({
      ...placed,
      routeFollower:
        placed.routeFollower === null
          ? null
          : advanceRouteFollower(
              arithmetic,
              placed.routeFollower,
              arithmetic.storeFloat(racer.driver.routeStepMilliseconds)
            ),
    })
    return setRacer(
      racerSet,
      racerIndex,
      Object.freeze({
        ...racer,
        ...setDriven(
          racer,
          releaseDriverRoute(arithmetic, { driver: racer.driver, carBody: advanced })
        ),
      })
    )
  }
  const driven = getDriven(racer)
  const timed = Object.freeze({
    driver: stepDriverStuckTimer(arithmetic, driven, stepMilliseconds),
    carBody: driven.carBody,
  })
  const steered = steerTowardsTarget(context, timed, route, targetOffset)
  const applied = applyDriverThrottle(arithmetic, applyDriverSteering(arithmetic, tables, steered))
  return setRacer(racerSet, racerIndex, setDriven(racer, applied))
}

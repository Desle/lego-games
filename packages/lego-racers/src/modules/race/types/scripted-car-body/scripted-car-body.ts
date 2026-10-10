import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import {
  advanceRouteFollower,
  createRouteFollower,
  getRampedTargetSpeedFactor,
  getReturnedLateralOffset,
  resetRouteFollower,
  setRouteFollowerSpeedFactor,
  stepComputerBounce,
  stepComputerSpeedFactor,
} from '../../../racer-ai/index.ts'
import type { ComputerSpeedState, RouteFollower } from '../../../racer-ai/index.ts'
import { getWithVelocitySplit, getWorldInverseInertia } from '../../../racer-physics/index.ts'
import type { CarRigidBody } from '../../../racer-physics/index.ts'
import type { CarBody } from '../../../racer/index.ts'
import { getMatrixFromQuaternion } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'

const DEFAULT_SPEED_FACTOR = 1

const getSpeedState = (carBody: CarBody): ComputerSpeedState =>
  Object.freeze({
    flags: carBody.rigidBody.flags,
    speedFactor: carBody.speedFactor,
    targetSpeedFactor: carBody.targetSpeedFactor,
    defaultTargetSpeedFactor: carBody.defaultTargetSpeedFactor,
  })

// 0x0042a670: the car body follows a script from now on. The follower restarts on the route (0x004a5200) and the
// frame takes the route's first position and rotation; the body is held (+0x748 = 1, 0x004374c0) until the start.
export const placeCarBodyOnRoute = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  route: ComputerRacerRoute
): CarBody => {
  const [x, y, z] = route.firstVector
  const [quaternionX, quaternionY, quaternionZ, quaternionW] = route.firstQuaternion
  const rotation = getMatrixFromQuaternion(arithmetic, {
    x: quaternionX,
    y: quaternionY,
    z: quaternionZ,
    w: quaternionW,
  })
  const displayFrame = Object.freeze({ rotation, position: Object.freeze({ x, y, z }) })
  const follower = resetRouteFollower(
    carBody.routeFollower ?? createRouteFollower(route, DEFAULT_SPEED_FACTOR),
    route
  )
  return Object.freeze({
    ...carBody,
    isScripted: true,
    isRouteHeld: true,
    routeFollower: follower,
    rigidBody: Object.freeze({ ...carBody.rigidBody, displayFrame }),
  })
}

// 0x0042a570: the frame follows the route, shifted along rotation row 1 by the sideways offset and up by the bounce.
const getBodyAtFollower = (
  arithmetic: FloatArithmetic,
  rigidBody: CarRigidBody,
  follower: RouteFollower,
  lateralOffset: number,
  bounceHeight: number
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const rotation = getMatrixFromQuaternion(arithmetic, follower.rotation)
  const rowOne = { x: rotation[3], y: rotation[4], z: rotation[5] }
  const height = storeFloat(
    add(add(add(subtract(follower.position.z, 0), 0), bounceHeight), rigidBody.twoPointHeight)
  )
  const position: Vector3 = Object.freeze({
    x: storeFloat(add(follower.position.x, multiply(rowOne.x, lateralOffset))),
    y: storeFloat(add(follower.position.y, storeFloat(multiply(rowOne.y, lateralOffset)))),
    z: storeFloat(add(storeFloat(multiply(rowOne.z, lateralOffset)), height)),
  })
  const heading: Vector3 = Object.freeze({ x: rotation[0], y: rotation[1], z: rotation[2] })
  const displayFrame = Object.freeze({ rotation, position })
  const placed: CarRigidBody = Object.freeze({
    ...rigidBody,
    displayFrame,
    groundedWheelCount: follower.contactState,
    heading,
  })
  return Object.freeze({
    ...placed,
    worldInverseInertia: getWorldInverseInertia(arithmetic, placed),
  })
}

// 0x00429d40 (thiscall: step) for one pass without a contact: the speed factor moves toward its target, the
// follower advances, the sideways offset and the bounce settle, the frame follows the route and the velocity is
// the distance moved over the step. Not ported: flag 0x8 (0x0042a100, 0x00448840), the contact loop
// (RigidBody_AdvanceToContact and the pass-start snapshot 0x0042a220) and the tilts and spins of 0x0042a290
// (all zero for a racer nothing else touches).
export const stepScriptedCarBody = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  stepMilliseconds: number
): CarBody => {
  const routeFollower = carBody.routeFollower
  if (stepMilliseconds === 0 || carBody.isRouteHeld || routeFollower === null) return carBody
  const { divide, subtract, multiply, storeFloat } = arithmetic
  const ramped = getRampedTargetSpeedFactor(
    arithmetic,
    getSpeedState(carBody),
    carBody.rampMilliseconds
  )
  const speed = stepComputerSpeedFactor(arithmetic, {
    state: ramped,
    contactState: carBody.rigidBody.groundedWheelCount,
    stepMilliseconds,
  })
  const follower = advanceRouteFollower(
    arithmetic,
    setRouteFollowerSpeedFactor(routeFollower, speed.speedFactor),
    stepMilliseconds
  )
  const lateralOffset = getReturnedLateralOffset(
    arithmetic,
    carBody.lateralOffset,
    stepMilliseconds
  )
  const bounce = stepComputerBounce(
    arithmetic,
    {
      flags: carBody.rigidBody.flags,
      height: carBody.bounceHeight,
      verticalSpeed: carBody.bounceVerticalSpeed,
    },
    stepMilliseconds
  )
  const previous = carBody.rigidBody.displayFrame.position
  const placed = getBodyAtFollower(
    arithmetic,
    Object.freeze({ ...carBody.rigidBody, flags: bounce.flags }),
    follower,
    lateralOffset,
    bounce.height
  )
  const current = placed.displayFrame.position
  const inverseStep = storeFloat(divide(1, stepMilliseconds))
  const getVelocity = (from: number, to: number): number =>
    storeFloat(multiply(inverseStep, storeFloat(subtract(to, from))))
  const moving: CarRigidBody = Object.freeze({
    ...placed,
    linearVelocity: Object.freeze({
      x: getVelocity(previous.x, current.x),
      y: getVelocity(previous.y, current.y),
      z: getVelocity(previous.z, current.z),
    }),
  })
  const split = getWithVelocitySplit(arithmetic, moving)
  return Object.freeze({
    ...carBody,
    speedFactor: speed.speedFactor,
    targetSpeedFactor: speed.targetSpeedFactor,
    defaultTargetSpeedFactor: speed.defaultTargetSpeedFactor,
    routeFollower: follower,
    lateralOffset,
    bounceHeight: bounce.height,
    bounceVerticalSpeed: bounce.verticalSpeed,
    rigidBody: Object.freeze({
      ...split,
      frame: Object.freeze({
        rotation: split.displayFrame.rotation,
        position: split.displayFrame.position,
      }),
    }),
  })
}

import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import {
  advanceRouteFollower,
  CONTACT_SPEED_FACTOR,
  createRouteFollower,
  getRampedTargetSpeedFactor,
  getReturnedLateralOffset,
  moveRouteFollower,
  resetRouteFollower,
  setRouteFollowerSpeedFactor,
  stepComputerBounce,
  stepComputerSpeedFactor,
} from '../../../racer-ai/index.ts'
import type { ComputerSpeedState, RouteFollower } from '../../../racer-ai/index.ts'
import {
  advanceToContact,
  CAR_RIGID_BODY_HOOKS,
  CarRigidBodyFlag,
  clearContacts,
  getBodyWithTwoPointOffsets,
  getWithVelocitySplit,
  getWorldInverseInertia,
  saveStepStart,
} from '../../../racer-physics/index.ts'
import type {
  CarRigidBody,
  CarRigidBodyHooks,
  CarRigidBodyStepInput,
} from '../../../racer-physics/index.ts'
import type { CarBody } from '../../../racer/index.ts'
import {
  getFrameTransformedPoint,
  getMatrixFromQuaternion,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getScriptedBodyOriented, getScriptedBodyWithTargetTilt } from './scripted-orientation.ts'

const DEFAULT_SPEED_FACTOR = 1

const getSpeedState = (carBody: CarBody): ComputerSpeedState =>
  Object.freeze({
    flags: carBody.rigidBody.flags,
    speedFactor: carBody.speedFactor,
    targetSpeedFactor: carBody.targetSpeedFactor,
    defaultTargetSpeedFactor: carBody.defaultTargetSpeedFactor,
  })

// 0x0042a670: the car body follows a script from now on. The follower restarts on the route (0x004a5200) and the
// display frame takes the route's first position and rotation (the physics frame keeps the start slot's); the world
// centre of mass and the four world hull points follow the display frame (frame slot +0x2c). The body is held
// (+0x748 = 1, 0x004374c0) until the start.
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
    rigidBody: Object.freeze({
      ...carBody.rigidBody,
      displayFrame,
      worldCentreOfMass: getFrameTransformedPoint(
        arithmetic,
        displayFrame,
        carBody.rigidBody.localCentreOfMass
      ),
      worldHullPoints: carBody.rigidBody.localHullPoints.map((point) =>
        getFrameTransformedPoint(arithmetic, displayFrame, point)
      ),
    }),
  })
}

// 0x0042a570: the frame follows the route, shifted along rotation row 1 by the sideways offset and up by the flip,
// the bounce and the two-point height; the centre of mass follows the frame.
export const getBodyAtFollower = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  follower: RouteFollower,
  lateralOffset: number,
  bounceHeight: number
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const { rigidBody } = carBody
  const { rotation } = rigidBody.displayFrame
  const rowOne = { x: rotation[3], y: rotation[4], z: rotation[5] }
  const height = storeFloat(
    add(
      add(add(subtract(follower.position.z, 0), carBody.flipHeight), bounceHeight),
      rigidBody.twoPointHeight
    )
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
    worldCentreOfMass: getFrameTransformedPoint(
      arithmetic,
      displayFrame,
      rigidBody.localCentreOfMass
    ),
    heading,
  })
  return Object.freeze({
    ...placed,
    worldInverseInertia: getWorldInverseInertia(arithmetic, placed),
  })
}

// One pass of 0x00429d40's loop (0x00429e0d..0x0042a0b2) for `stepMilliseconds`: the speed factor moves toward its
// target, the follower advances, the sideways offset and the two-point values settle, the bounce falls, the frame
// takes the route's orientation (0x0042a290) and place (0x0042a570), and the velocity is the distance moved over
// the step.
const runScriptedPass = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  follower: RouteFollower,
  stepMilliseconds: number
): CarBody => {
  const { divide, subtract, multiply, storeFloat } = arithmetic
  const speed = stepComputerSpeedFactor(arithmetic, {
    state: getSpeedState(carBody),
    contactState: carBody.rigidBody.groundedWheelCount,
    stepMilliseconds,
  })
  const advanced = advanceRouteFollower(
    arithmetic,
    setRouteFollowerSpeedFactor(follower, speed.speedFactor),
    stepMilliseconds
  )
  const lateralOffset = getReturnedLateralOffset(
    arithmetic,
    carBody.lateralOffset,
    stepMilliseconds
  )
  const isTwoPoint =
    (carBody.rigidBody.flags & CarRigidBodyFlag.TWO_POINT) !== 0 ||
    !arithmetic.getIsEqual(carBody.rigidBody.twoPointHeight, 0)
  const settled = isTwoPoint
    ? getBodyWithTwoPointOffsets(arithmetic, carBody.rigidBody, stepMilliseconds)
    : carBody.rigidBody
  const bounce = stepComputerBounce(
    arithmetic,
    {
      flags: settled.flags,
      height: carBody.bounceHeight,
      verticalSpeed: carBody.bounceVerticalSpeed,
    },
    stepMilliseconds
  )
  const previous = carBody.rigidBody.displayFrame.position
  const routed: CarBody = Object.freeze({
    ...carBody,
    speedFactor: speed.speedFactor,
    targetSpeedFactor: speed.targetSpeedFactor,
    defaultTargetSpeedFactor: speed.defaultTargetSpeedFactor,
    routeFollower: advanced,
    lateralOffset,
    bounceHeight: bounce.height,
    bounceVerticalSpeed: bounce.verticalSpeed,
    rigidBody: Object.freeze({ ...settled, flags: bounce.flags }),
  })
  const oriented = getScriptedBodyOriented(arithmetic, routed, stepMilliseconds)
  const placed = getBodyAtFollower(arithmetic, oriented, advanced, lateralOffset, bounce.height)
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
    ...oriented,
    rigidBody: Object.freeze({
      ...split,
      frame: Object.freeze({
        rotation: split.displayFrame.rotation,
        position: split.displayFrame.position,
      }),
    }),
  })
}

// The part of 0x00429d40 before its loop: the tilt the body leans to (flag 0x8, 0x0042a100) and the target speed
// factor of a ramped body (flag 0x10000, while the ramp time is under 2,000).
const getBodyBeforeLoop = (arithmetic: FloatArithmetic, carBody: CarBody): CarBody => {
  const tilted =
    (carBody.rigidBody.flags & CarRigidBodyFlag.TWO_POINT) !== 0
      ? getScriptedBodyWithTargetTilt(arithmetic, carBody)
      : carBody
  const ramped = getRampedTargetSpeedFactor(
    arithmetic,
    getSpeedState(tilted),
    tilted.rampMilliseconds
  )
  return Object.freeze({ ...tilted, targetSpeedFactor: ramped.targetSpeedFactor })
}

// 0x00429d40 (thiscall: step), CarBody_StepOnRoute: the body follows its route. 0x0042a220 saves the pass start (the
// rigid body's 0x004474c0), the loop runs a pass, then RigidBody_AdvanceToContact tests the hull points against the
// moving objects only (the checkpoint object: its filter takes the checkpoint touches); a contact that counts puts the
// body back at the pass start for the time before it, with the route speed factor at -0.1, and runs again.
export const stepScriptedCarBody = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  input: CarRigidBodyStepInput,
  hooks: CarRigidBodyHooks = CAR_RIGID_BODY_HOOKS
): CarBody => {
  const { stepMilliseconds, collisionObjects } = input
  const { routeFollower } = carBody
  if (stepMilliseconds === 0 || carBody.isRouteHeld || routeFollower === null) return carBody
  const prepared = getBodyBeforeLoop(arithmetic, carBody)
  let current: CarBody = Object.freeze({
    ...prepared,
    rigidBody: saveStepStart(prepared.rigidBody),
  })
  let remaining = stepMilliseconds
  do {
    if (remaining !== 0 && current.routeFollower !== null) {
      current = runScriptedPass(arithmetic, current, current.routeFollower, remaining)
    }
    if (current.rigidBody.contactCount === 0) {
      const advance = advanceToContact(
        arithmetic,
        current.rigidBody,
        remaining,
        collisionObjects,
        hooks,
        false
      )
      current = Object.freeze({ ...current, rigidBody: advance.body })
      remaining = advance.remainingMilliseconds
    } else {
      const cleared = saveStepStart(clearContacts(current.rigidBody))
      current = Object.freeze({
        ...current,
        speedFactor: CONTACT_SPEED_FACTOR,
        routeFollower:
          current.routeFollower === null
            ? null
            : setRouteFollowerSpeedFactor(current.routeFollower, CONTACT_SPEED_FACTOR),
        rigidBody: cleared,
      })
      remaining = cleared.stepRemaining
    }
  } while (current.rigidBody.contactCount !== 0)
  return current
}

// 0x00429680 (thiscall: displacement) for a scripted body: the follower is moved along the route by the displacement
// (0x004a5750), the frame takes the orientation again (0x0042a290 with no time), the sideways offset is the part of
// what is left of the displacement along rotation row 1, held to the route's lateral room, and the frame is placed
// (0x0042a570).
export const getScriptedBodySeparated = (
  arithmetic: FloatArithmetic,
  carBody: CarBody,
  displacement: Vector3
): CarBody => {
  const { routeFollower } = carBody
  if (routeFollower === null) return carBody
  const { add, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const moved = moveRouteFollower(arithmetic, routeFollower, displacement)
  const oriented = getScriptedBodyOriented(
    arithmetic,
    Object.freeze({ ...carBody, routeFollower: moved.follower }),
    0
  )
  const { rotation } = oriented.rigidBody.displayFrame
  const left = moved.displacement
  const offset = add(
    add(multiply(left.z, rotation[5]), multiply(left.y, rotation[4])),
    multiply(left.x, rotation[3])
  )
  const { negativeLateralLimit, positiveLateralLimit } = moved.follower
  const lateralOffset = getIsBelowOrEqual(offset, 0)
    ? getIsBelow(negativeLateralLimit, -offset)
      ? -negativeLateralLimit
      : storeFloat(offset)
    : getIsBelow(positiveLateralLimit, offset)
      ? positiveLateralLimit
      : storeFloat(offset)
  return Object.freeze({
    ...oriented,
    lateralOffset,
    rigidBody: getBodyAtFollower(
      arithmetic,
      oriented,
      moved.follower,
      lateralOffset,
      oriented.bounceHeight
    ),
  })
}

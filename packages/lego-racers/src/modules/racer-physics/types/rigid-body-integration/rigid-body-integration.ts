import {
  getFrameAxes,
  getRotationFromFrameAxes,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getAngularVelocity } from '../rigid-body/rigid-body.ts'
import type { RigidBody } from '../racer-physics.types.ts'

// float32 0x38d1b717 at 0x004b0b70.
const RESTING_SPEED = Math.fround(0.0001)
// float32 0x3a1d4952 at 0x004b0b74: compared with the squared rotation of one step.
const RESTING_ROTATION_SQUARED = Math.fround(0.0006)

// Applies θ × axis for a small rotation θ, each component as (a ± b) ± c in the code's order.
const getAxisRotatedBy = (
  arithmetic: FloatArithmetic,
  axis: Vector3,
  rotation: Vector3
): Vector3 => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  return Object.freeze({
    x: storeFloat(
      add(subtract(axis.x, multiply(axis.y, rotation.z)), multiply(axis.z, rotation.y))
    ),
    y: storeFloat(
      subtract(add(multiply(axis.x, rotation.z), axis.y), multiply(axis.z, rotation.x))
    ),
    z: storeFloat(
      add(subtract(axis.z, multiply(axis.x, rotation.y)), multiply(axis.y, rotation.x))
    ),
  })
}

const getIsResting = (arithmetic: FloatArithmetic, speed: number): boolean =>
  arithmetic.getIsBelow(speed, RESTING_SPEED) && arithmetic.getIsBelow(-RESTING_SPEED, speed)

// RigidBody_Integrate 0x00440e10 (thiscall: integer milliseconds). Semi-implicit step of one body, no contacts.
export const integrateRigidBody = <Body extends RigidBody>(
  arithmetic: FloatArithmetic,
  body: Body,
  stepMilliseconds: number
): Body => {
  const { add, multiply, storeFloat, getIsEqual, getIsBelow } = arithmetic
  const angularVelocity = getAngularVelocity(arithmetic, body)
  const step = storeFloat(stepMilliseconds)
  const getVelocityChange = (force: number): number =>
    storeFloat(multiply(multiply(force, step), body.inverseMass))
  const velocityChange = {
    x: getVelocityChange(body.force.x),
    y: getVelocityChange(body.force.y),
    z: getVelocityChange(body.force.z),
  }
  const halfStep = storeFloat(multiply(step, 0.5))
  const getMovedCoordinate = (coordinate: number, velocity: number, change: number): number =>
    storeFloat(add(add(multiply(velocity, step), multiply(halfStep, change)), coordinate))
  const { position } = body.frame
  const { linearVelocity } = body
  const movedPosition = Object.freeze({
    x: getMovedCoordinate(position.x, linearVelocity.x, velocityChange.x),
    y: getMovedCoordinate(position.y, linearVelocity.y, velocityChange.y),
    z: getMovedCoordinate(position.z, linearVelocity.z, velocityChange.z),
  })
  const isWithoutVelocityChange =
    getIsEqual(velocityChange.x, 0) &&
    getIsEqual(velocityChange.y, 0) &&
    getIsEqual(velocityChange.z, 0)
  const getRestingVelocity = (velocity: number): number =>
    isWithoutVelocityChange && getIsResting(arithmetic, velocity) ? 0 : velocity
  const nextLinearVelocity = Object.freeze({
    x: storeFloat(add(velocityChange.x, getRestingVelocity(linearVelocity.x))),
    y: storeFloat(add(velocityChange.y, getRestingVelocity(linearVelocity.y))),
    z: storeFloat(add(velocityChange.z, getRestingVelocity(linearVelocity.z))),
  })
  const rotation = Object.freeze({
    x: storeFloat(multiply(angularVelocity.x, step)),
    y: storeFloat(multiply(angularVelocity.y, step)),
    z: storeFloat(multiply(angularVelocity.z, step)),
  })
  const axes = getFrameAxes(body.frame.rotation)
  const nextRotation = getRotationFromFrameAxes(arithmetic, {
    first: getAxisRotatedBy(arithmetic, axes.first, rotation),
    third: getAxisRotatedBy(arithmetic, axes.third, rotation),
  })
  const { torque, angularMomentum } = body
  const momentumChangeY = storeFloat(multiply(torque.y, step))
  const momentumChangeZ = storeFloat(multiply(torque.z, step))
  const nextAngularMomentum = Object.freeze({
    x: storeFloat(add(multiply(step, torque.x), angularMomentum.x)),
    y: storeFloat(add(momentumChangeY, angularMomentum.y)),
    z: storeFloat(add(momentumChangeZ, angularMomentum.z)),
  })
  const rotationSquared = add(
    add(multiply(rotation.z, rotation.z), multiply(rotation.y, rotation.y)),
    multiply(rotation.x, rotation.x)
  )
  const isAtRest =
    getIsEqual(torque.x, 0) &&
    getIsEqual(torque.y, 0) &&
    getIsEqual(torque.z, 0) &&
    getIsBelow(rotationSquared, RESTING_ROTATION_SQUARED)
  return Object.freeze({
    ...body,
    frame: Object.freeze({ rotation: nextRotation, position: movedPosition }),
    linearVelocity: nextLinearVelocity,
    angularVelocity: isAtRest ? ZERO_VECTOR3 : angularVelocity,
    angularMomentum: isAtRest ? ZERO_VECTOR3 : nextAngularMomentum,
    force: ZERO_VECTOR3,
    torque: ZERO_VECTOR3,
  })
}

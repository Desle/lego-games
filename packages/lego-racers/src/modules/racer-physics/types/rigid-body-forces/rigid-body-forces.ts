import {
  getFrameInverseRotatedVector,
  getFrameRotatedVector,
  getNormalizedVector3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { RigidBody } from '../racer-physics.types.ts'

// 0x00440b10 (thiscall: force): adds to the force accumulator (+0xb0).
export const addForce = <Body extends RigidBody>(
  arithmetic: FloatArithmetic,
  body: Body,
  force: Vector3
): Body => {
  const { add, storeFloat } = arithmetic
  return Object.freeze({
    ...body,
    force: Object.freeze({
      x: storeFloat(add(force.x, body.force.x)),
      y: storeFloat(add(force.y, body.force.y)),
      z: storeFloat(add(force.z, body.force.z)),
    }),
  })
}

// 0x00440b50 (thiscall: force, world point): adds (point - world centre of mass) × force to the torque (+0xbc).
export const addTorqueOfForceAtPoint = <Body extends RigidBody>(
  arithmetic: FloatArithmetic,
  body: Body,
  force: Vector3,
  point: Vector3
): Body => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const armX = subtract(point.x, body.worldCentreOfMass.x)
  const armY = subtract(point.y, body.worldCentreOfMass.y)
  const armZ = subtract(point.z, body.worldCentreOfMass.z)
  const torqueX = storeFloat(subtract(multiply(armY, force.z), multiply(force.y, armZ)))
  const torqueY = storeFloat(subtract(multiply(armZ, force.x), multiply(force.z, armX)))
  const torqueZ = subtract(multiply(armX, force.y), multiply(armY, force.x))
  return Object.freeze({
    ...body,
    torque: Object.freeze({
      x: storeFloat(add(torqueX, body.torque.x)),
      y: storeFloat(add(torqueY, body.torque.y)),
      z: storeFloat(add(torqueZ, body.torque.z)),
    }),
  })
}

// 0x00440da0 (thiscall: axis): removes the angular momentum (+0xa4) along a unit axis.
export const removeAngularMomentumAlongAxis = <Body extends RigidBody>(
  arithmetic: FloatArithmetic,
  body: Body,
  axis: Vector3
): Body => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const momentum = body.angularMomentum
  const dot = add(
    add(multiply(momentum.z, axis.z), multiply(momentum.y, axis.y)),
    multiply(momentum.x, axis.x)
  )
  const projectionX = storeFloat(multiply(dot, axis.x))
  const projectionY = storeFloat(multiply(axis.y, dot))
  const projectionZ = multiply(dot, axis.z)
  return Object.freeze({
    ...body,
    angularMomentum: Object.freeze({
      x: storeFloat(subtract(momentum.x, projectionX)),
      y: storeFloat(subtract(momentum.y, projectionY)),
      z: storeFloat(subtract(momentum.z, projectionZ)),
    }),
  })
}

// 0x00440cb0 (thiscall: force, world point): when the angular momentum points along
// normalize((point - world centre of mass) × force), that part of it is removed.
export const removeAngularMomentumAgainstForce = <Body extends RigidBody>(
  arithmetic: FloatArithmetic,
  body: Body,
  force: Vector3,
  point: Vector3
): Body => {
  const { add, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  const armX = subtract(point.x, body.worldCentreOfMass.x)
  const armY = subtract(point.y, body.worldCentreOfMass.y)
  const armZ = subtract(point.z, body.worldCentreOfMass.z)
  const axis = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(multiply(armY, force.z), multiply(force.y, armZ))),
    y: storeFloat(subtract(multiply(armZ, force.x), multiply(force.z, armX))),
    z: storeFloat(subtract(multiply(force.y, armX), multiply(armY, force.x))),
  })
  const momentum = body.angularMomentum
  const dot = add(
    add(multiply(momentum.z, axis.z), multiply(momentum.y, axis.y)),
    multiply(axis.x, momentum.x)
  )
  if (getIsBelow(dot, 0)) return body
  return Object.freeze({
    ...body,
    angularMomentum: Object.freeze({
      x: storeFloat(subtract(momentum.x, multiply(axis.x, dot))),
      y: storeFloat(subtract(momentum.y, storeFloat(multiply(axis.y, dot)))),
      z: storeFloat(subtract(momentum.z, storeFloat(multiply(axis.z, dot)))),
    }),
  })
}

// 0x00440bd0 (thiscall: world angular velocity): adds the angular momentum that turns the body at
// that rate: the rate in the frame, times the frame inertia (+0x2c), turned back to world space.
export const addAngularVelocity = <Body extends RigidBody>(
  arithmetic: FloatArithmetic,
  body: Body,
  angularVelocity: Vector3
): Body => {
  const { add, multiply, storeFloat } = arithmetic
  const inertia = body.localInertia
  const local = getFrameInverseRotatedVector(arithmetic, body.frame, angularVelocity)
  const getStoredSum = (column: 1 | 2): number =>
    storeFloat(
      add(
        multiply(inertia[column + 6] ?? 0, local.z),
        storeFloat(
          add(
            multiply(inertia[column + 3] ?? 0, local.y),
            storeFloat(multiply(inertia[column], local.x))
          )
        )
      )
    )
  const momentum = Object.freeze({
    x: storeFloat(
      add(
        multiply(inertia[6], local.z),
        add(multiply(inertia[0], local.x), multiply(inertia[3], local.y))
      )
    ),
    y: getStoredSum(1),
    z: getStoredSum(2),
  })
  const world = getFrameRotatedVector(arithmetic, body.frame, momentum)
  return Object.freeze({
    ...body,
    angularMomentum: Object.freeze({
      x: storeFloat(add(world.x, body.angularMomentum.x)),
      y: storeFloat(add(world.y, body.angularMomentum.y)),
      z: storeFloat(add(world.z, body.angularMomentum.z)),
    }),
  })
}

import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { RigidBody } from '../racer-physics.types.ts'

// 0x00440b10 (thiscall: force): adds to the force accumulator (+0xb0).
export const addForce = (
  arithmetic: FloatArithmetic,
  body: RigidBody,
  force: Vector3
): RigidBody => {
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
export const addTorqueOfForceAtPoint = (
  arithmetic: FloatArithmetic,
  body: RigidBody,
  force: Vector3,
  point: Vector3
): RigidBody => {
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
export const removeAngularMomentumAlongAxis = (
  arithmetic: FloatArithmetic,
  body: RigidBody,
  axis: Vector3
): RigidBody => {
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

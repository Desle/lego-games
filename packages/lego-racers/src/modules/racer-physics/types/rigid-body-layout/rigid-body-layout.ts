import { IDENTITY_MATRIX3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import type { RigidBody } from '../racer-physics.types.ts'

// Byte offsets inside the original rigid body (physics.md), used to lay the port's state out for the emulator in the differential specs.
export const RIGID_BODY_OFFSET = Object.freeze({
  frame: 0x04,
  linearVelocity: 0x08,
  worldCentreOfMass: 0x20,
  localInertia: 0x2c,
  localInverseInertia: 0x50,
  worldInverseInertia: 0x74,
  angularVelocity: 0x98,
  angularMomentum: 0xa4,
  force: 0xb0,
  torque: 0xbc,
  mass: 0xc8,
  inverseMass: 0xcc,
  dimensions: 0xd0,
})

export const FRAME_OFFSET = Object.freeze({ rotation: 0x28, position: 0x4c })

export const RIGID_BODY_BYTE_SIZE = 0x200
export const FRAME_BYTE_SIZE = 0x80

export const BLANK_RIGID_BODY: RigidBody = Object.freeze({
  frame: Object.freeze({ rotation: IDENTITY_MATRIX3, position: ZERO_VECTOR3 }),
  linearVelocity: ZERO_VECTOR3,
  localCentreOfMass: ZERO_VECTOR3,
  worldCentreOfMass: ZERO_VECTOR3,
  localInertia: IDENTITY_MATRIX3,
  localInverseInertia: IDENTITY_MATRIX3,
  worldInverseInertia: IDENTITY_MATRIX3,
  angularVelocity: ZERO_VECTOR3,
  angularMomentum: ZERO_VECTOR3,
  force: ZERO_VECTOR3,
  torque: ZERO_VECTOR3,
  mass: 1,
  inverseMass: 1,
  dimensions: ZERO_VECTOR3,
})

export const toVector3 = (values: readonly number[], start: number): Vector3 =>
  Object.freeze({
    x: values[start] ?? 0,
    y: values[start + 1] ?? 0,
    z: values[start + 2] ?? 0,
  })

export const toMatrix3 = (values: readonly number[], start: number): Matrix3 =>
  Object.freeze([
    values[start] ?? 0,
    values[start + 1] ?? 0,
    values[start + 2] ?? 0,
    values[start + 3] ?? 0,
    values[start + 4] ?? 0,
    values[start + 5] ?? 0,
    values[start + 6] ?? 0,
    values[start + 7] ?? 0,
    values[start + 8] ?? 0,
  ])

export const toList = (vector: Vector3): readonly number[] => [vector.x, vector.y, vector.z]

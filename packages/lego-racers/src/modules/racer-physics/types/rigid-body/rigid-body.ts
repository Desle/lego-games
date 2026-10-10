import { getMatrixInFrame, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import type { BoxInertia, BoxRigidBodyDefinition, RigidBody } from '../racer-physics.types.ts'

// float32 0x3daaaaab at 0x004b0b90.
const ONE_TWELFTH = Math.fround(1 / 12)

// Box body slot 0, 0x00441260. Note the mass is divided by the dimension on the same axis.
export const getBoxInertia = (
  arithmetic: FloatArithmetic,
  mass: number,
  dimensions: Vector3
): BoxInertia => {
  const { add, multiply, divide, storeFloat } = arithmetic
  const squaredX = multiply(dimensions.x, dimensions.x)
  const squaredY = multiply(dimensions.y, dimensions.y)
  const squaredZ = multiply(dimensions.z, dimensions.z)
  const inertiaX = storeFloat(
    multiply(multiply(add(squaredZ, squaredY), divide(mass, dimensions.x)), ONE_TWELFTH)
  )
  const inertiaY = storeFloat(
    multiply(multiply(add(squaredZ, squaredX), divide(mass, dimensions.y)), ONE_TWELFTH)
  )
  // FST keeps the unrounded value; the inverse below divides by it, not by the stored copy.
  const unroundedInertiaZ = multiply(
    multiply(add(squaredY, squaredX), divide(mass, dimensions.z)),
    ONE_TWELFTH
  )
  const localInertia: Matrix3 = Object.freeze([
    inertiaX,
    0,
    0,
    0,
    inertiaY,
    0,
    0,
    0,
    storeFloat(unroundedInertiaZ),
  ])
  const localInverseInertia: Matrix3 = Object.freeze([
    storeFloat(divide(1, inertiaX)),
    0,
    0,
    0,
    storeFloat(divide(1, inertiaY)),
    0,
    0,
    0,
    storeFloat(divide(1, unroundedInertiaZ)),
  ])
  return Object.freeze({ localInertia, localInverseInertia })
}

// 0x00440a60: frame method 0x00410f30 on the local inverse inertia (+0x50), into +0x74.
export const getWorldInverseInertia = (arithmetic: FloatArithmetic, body: RigidBody): Matrix3 =>
  getMatrixInFrame(arithmetic, body.frame.rotation, body.localInverseInertia)

// 0x00440a80: angular velocity (+0x98) = angular momentum (+0xa4) as a row vector times +0x74.
export const getAngularVelocity = (arithmetic: FloatArithmetic, body: RigidBody): Vector3 => {
  const { add, multiply, storeFloat } = arithmetic
  const { worldInverseInertia: inertia, angularMomentum: momentum } = body
  const getComponent = (column: 0 | 1 | 2): number =>
    storeFloat(
      add(
        add(
          multiply(inertia[6 + column] ?? 0, momentum.z),
          multiply(inertia[3 + column] ?? 0, momentum.y)
        ),
        multiply(inertia[column], momentum.x)
      )
    )
  return Object.freeze({ x: getComponent(0), y: getComponent(1), z: getComponent(2) })
}

// Box body constructor 0x004411d0 with 0x00441210 (dimensions) and attach 0x004409f0 (mass, slot 0, 0x00440a60).
export const createBoxRigidBody = (
  arithmetic: FloatArithmetic,
  definition: BoxRigidBodyDefinition
): RigidBody => {
  const { localInertia, localInverseInertia } = getBoxInertia(
    arithmetic,
    definition.mass,
    definition.dimensions
  )
  const body: RigidBody = {
    frame: definition.frame,
    linearVelocity: ZERO_VECTOR3,
    localCentreOfMass: ZERO_VECTOR3,
    worldCentreOfMass: ZERO_VECTOR3,
    localInertia,
    localInverseInertia,
    worldInverseInertia: localInverseInertia,
    angularVelocity: ZERO_VECTOR3,
    angularMomentum: ZERO_VECTOR3,
    force: ZERO_VECTOR3,
    torque: ZERO_VECTOR3,
    mass: arithmetic.storeFloat(definition.mass),
    inverseMass: arithmetic.storeFloat(arithmetic.divide(1, definition.mass)),
    dimensions: definition.dimensions,
  }
  return Object.freeze({ ...body, worldInverseInertia: getWorldInverseInertia(arithmetic, body) })
}

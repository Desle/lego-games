import type { FloatArithmetic, Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import { getNormalizedVector3 } from '../../../simulation-math/index.ts'

// The emitter object's reset basis (0x004894a0): the identity.
export const IDENTITY_EMITTER_BASIS: Matrix3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1] as const)

// 0x00489540: row 0 is the normalised facing, row 2 the up direction made orthogonal to it and normalised, row 1
// their cross product. The projection of `up` on the facing stays unrounded on the FPU stack; every other
// intermediate that the original stores is stored.
export const getEmitterBasis = (
  arithmetic: FloatArithmetic,
  facing: Vector3,
  up: Vector3
): Matrix3 => {
  const { add, multiply, storeFloat, subtract } = arithmetic
  const direction = getNormalizedVector3(arithmetic, facing)
  const projection = add(
    add(multiply(up.y, direction.y), multiply(direction.z, up.z)),
    multiply(direction.x, up.x)
  )
  const upright = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(up.x, storeFloat(multiply(direction.x, projection)))),
    y: storeFloat(subtract(up.y, storeFloat(multiply(direction.y, projection)))),
    z: storeFloat(subtract(up.z, multiply(projection, direction.z))),
  })
  const side = {
    x: storeFloat(subtract(multiply(upright.y, direction.z), multiply(upright.z, direction.y))),
    y: storeFloat(subtract(multiply(upright.z, direction.x), multiply(direction.z, upright.x))),
    z: storeFloat(subtract(multiply(direction.y, upright.x), multiply(upright.y, direction.x))),
  }
  return Object.freeze([
    direction.x,
    direction.y,
    direction.z,
    side.x,
    side.y,
    side.z,
    upright.x,
    upright.y,
    upright.z,
  ] as const)
}

// 0x004897e0: a definition point (x, y, z) times the basis, then the velocity offset; x stays unrounded until the
// offset is added, y and z are stored before it.
export const getEmitterVelocity = (
  arithmetic: FloatArithmetic,
  basis: Matrix3,
  point: Vector3,
  offset: Vector3
): Vector3 => {
  const { add, multiply, storeFloat } = arithmetic
  const [first, second, third, fourth, fifth, sixth, seventh, eighth, ninth] = basis
  const x = add(
    add(multiply(seventh, point.z), multiply(fourth, point.y)),
    multiply(first, point.x)
  )
  const y = storeFloat(
    add(add(multiply(eighth, point.z), multiply(fifth, point.y)), multiply(second, point.x))
  )
  const z = storeFloat(
    add(add(multiply(ninth, point.z), multiply(sixth, point.y)), multiply(third, point.x))
  )
  return Object.freeze({
    x: storeFloat(add(x, offset.x)),
    y: storeFloat(add(y, offset.y)),
    z: storeFloat(add(z, offset.z)),
  })
}

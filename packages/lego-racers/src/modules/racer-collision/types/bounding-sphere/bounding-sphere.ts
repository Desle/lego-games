import { FLOAT32_MAXIMUM, getFrameTransformedPoint } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Frame, Vector3 } from '../../../simulation-math/index.ts'
import type { BoundingInterval, BoundingSphere } from '../racer-collision.types.ts'

// 0x004113d0 (frame vtable 0x004af754 slot 0x4c, called when the radius +0x10 is negative, which
// every position write leaves it at): the model frame's sphere centre carried by the frame (slot +0x2c,
// 0x00410d60) and the radius scaled by the frame's scale (+0x58, 1.0 unless changed).
export const getBoundingSphere = (
  arithmetic: FloatArithmetic,
  frame: Frame,
  centre: Vector3,
  radius: number,
  scale = 1
): BoundingSphere => {
  const { multiply, storeFloat } = arithmetic
  return Object.freeze({
    centre: getFrameTransformedPoint(
      arithmetic,
      frame,
      Object.freeze({
        x: storeFloat(multiply(centre.x, scale)),
        y: storeFloat(multiply(centre.y, scale)),
        z: storeFloat(multiply(centre.z, scale)),
      })
    ),
    radius: storeFloat(multiply(scale, radius)),
  })
}

// 0x00410f10: the sphere's extent along x, `centre − radius` and `radius + centre`, each stored.
export const getBoundingInterval = (
  arithmetic: FloatArithmetic,
  sphere: BoundingSphere
): BoundingInterval =>
  Object.freeze({
    minimum: arithmetic.storeFloat(arithmetic.subtract(sphere.centre.x, sphere.radius)),
    maximum: arithmetic.storeFloat(arithmetic.add(sphere.radius, sphere.centre.x)),
  })

// 0x00411b90 (thiscall on one sphere: the other): the squared distance of the centres, summed as
// (z² + y²) + x² and never stored, is below the squared radius sum; the exact value FLT_MAX or a
// NaN means no overlap.
export const getSpheresOverlap = (
  arithmetic: FloatArithmetic,
  sphere: BoundingSphere,
  other: BoundingSphere
): boolean => {
  const { add, subtract, multiply, getIsEqual, getIsBelow } = arithmetic
  const x = subtract(other.centre.x, sphere.centre.x)
  const y = subtract(other.centre.y, sphere.centre.y)
  const z = subtract(other.centre.z, sphere.centre.z)
  const squaredDistance = add(add(multiply(z, z), multiply(y, y)), multiply(x, x))
  if (getIsEqual(squaredDistance, FLOAT32_MAXIMUM)) return false
  const radiusSum = add(other.radius, sphere.radius)
  return getIsBelow(squaredDistance, multiply(radiusSum, radiusSum))
}

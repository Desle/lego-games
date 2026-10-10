import { getNormalizedVector3 } from '../vector/vector.ts'
import type { FloatArithmetic, FrameAxes, Matrix3 } from '../simulation-math.types.ts'

// Frame slot +0x48, 0x00403c90 (thiscall: first target, third target): rows 0 and 2 of the rotation.
export const getFrameAxes = (rotation: Matrix3): FrameAxes =>
  Object.freeze({
    first: Object.freeze({ x: rotation[0], y: rotation[1], z: rotation[2] }),
    third: Object.freeze({ x: rotation[6], y: rotation[7], z: rotation[8] }),
  })

// Frame slot +0x40, 0x00410900 (thiscall: first, third): Gram-Schmidt; row 1 is third × first.
export const getRotationFromFrameAxes = (arithmetic: FloatArithmetic, axes: FrameAxes): Matrix3 => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const { third } = axes
  const first = getNormalizedVector3(arithmetic, axes.first)
  const dot = add(
    add(multiply(third.y, first.y), multiply(first.z, third.z)),
    multiply(first.x, third.x)
  )
  const projectionX = storeFloat(multiply(first.x, dot))
  const projectionY = storeFloat(multiply(first.y, dot))
  const projectionZ = multiply(dot, first.z)
  const orthogonalThird = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(third.x, projectionX)),
    y: storeFloat(subtract(third.y, projectionY)),
    z: storeFloat(subtract(third.z, projectionZ)),
  })
  return Object.freeze([
    first.x,
    first.y,
    first.z,
    storeFloat(
      subtract(multiply(orthogonalThird.y, first.z), multiply(orthogonalThird.z, first.y))
    ),
    storeFloat(
      subtract(multiply(orthogonalThird.z, first.x), multiply(first.z, orthogonalThird.x))
    ),
    storeFloat(
      subtract(multiply(first.y, orthogonalThird.x), multiply(orthogonalThird.y, first.x))
    ),
    orthogonalThird.x,
    orthogonalThird.y,
    orthogonalThird.z,
  ])
}

import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { SceneRotation, SceneVector } from '../scene.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, subtract, multiply, divide, getSquareRoot, storeFloat } = arithmetic

const ZERO_VECTOR: SceneVector = Object.freeze({ x: 0, y: 0, z: 0 })

// GolDP.dll 0x1002f530: scales to unit length, `1 / sqrt((x² + y²) + z²)` kept on the FPU stack and each product
// stored; a zero (or NaN) length leaves a zero vector.
const getNormalized = (vector: SceneVector): SceneVector => {
  const length = getSquareRoot(
    add(
      add(multiply(vector.x, vector.x), multiply(vector.y, vector.y)),
      multiply(vector.z, vector.z)
    )
  )
  if (length === 0 || Number.isNaN(length)) return ZERO_VECTOR
  const inverseLength = divide(1, length)
  return Object.freeze({
    x: storeFloat(multiply(inverseLength, vector.x)),
    y: storeFloat(multiply(inverseLength, vector.y)),
    z: storeFloat(multiply(inverseLength, vector.z)),
  })
}

// GolDP.dll 0x10026b50 (instance vtable +0x40): forward is normalised, up made orthogonal to it and
// normalised; the rows are forward, up × forward, up. The dot product `(u.y·f.y + f.z·u.z) + f.x·u.x` stays on the
// FPU stack, as does the z product of the correction.
export const getInstanceRotation = (forward: SceneVector, up: SceneVector): SceneRotation => {
  const first = getNormalized(forward)
  const dot = add(add(multiply(up.y, first.y), multiply(first.z, up.z)), multiply(first.x, up.x))
  const third = getNormalized({
    x: storeFloat(subtract(up.x, storeFloat(multiply(first.x, dot)))),
    y: storeFloat(subtract(up.y, storeFloat(multiply(first.y, dot)))),
    z: storeFloat(subtract(up.z, multiply(dot, first.z))),
  })
  return Object.freeze([
    first.x,
    first.y,
    first.z,
    storeFloat(subtract(multiply(third.y, first.z), multiply(third.z, first.y))),
    storeFloat(subtract(multiply(third.z, first.x), multiply(first.z, third.x))),
    storeFloat(subtract(multiply(first.y, third.x), multiply(third.y, first.x))),
    third.x,
    third.y,
    third.z,
  ])
}

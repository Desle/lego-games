import {
  createFloatArithmetic,
  getNormalizedVector3,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { SceneRotation, SceneVector } from '../scene.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, subtract, multiply, storeFloat } = arithmetic

// 0x1002f530 normalises as 0x004492d0 does: `1 / sqrt((x² + y²) + z²)` kept on the FPU stack and each product stored.
const getNormalized = (vector: SceneVector): SceneVector => getNormalizedVector3(arithmetic, vector)

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

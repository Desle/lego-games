import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { DecalFrame, DecalPlacement } from '../../types/decal.types.ts'

const { add, subtract, multiply, divide, getSquareRoot, storeFloat } =
  createFloatArithmetic(RACE_FPU_PRECISION)

const ZERO: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 })

// 0x004492d0: the vector divided by its length (the sum (z² + y²) + x²), or zero when it has none.
export const getNormalizedDecalVector = (vector: Vector3): Vector3 => {
  const length = getSquareRoot(
    add(
      add(multiply(vector.z, vector.z), multiply(vector.y, vector.y)),
      multiply(vector.x, vector.x)
    )
  )
  if (length === 0) return ZERO
  const inverse = divide(1, length)
  return Object.freeze({
    x: storeFloat(multiply(inverse, vector.x)),
    y: storeFloat(multiply(inverse, vector.y)),
    z: storeFloat(multiply(inverse, vector.z)),
  })
}

// 0x00414c90 (decal, normal, up hint): the projection direction normalised (+0xdc), the hint made perpendicular to it
// (its component along the normal removed) and normalised (+0xd0), and the right vector (+0xc4) as
// up x normal.
export const createDecalFrame = (placement: DecalPlacement): DecalFrame => {
  const normal = getNormalizedDecalVector(placement.normal)
  const { upHint } = placement
  const along = add(
    add(multiply(normal.x, upHint.x), multiply(normal.y, upHint.y)),
    multiply(normal.z, upHint.z)
  )
  const up = getNormalizedDecalVector({
    x: storeFloat(subtract(upHint.x, multiply(along, normal.x))),
    y: storeFloat(subtract(upHint.y, multiply(normal.y, along))),
    z: storeFloat(subtract(upHint.z, multiply(along, normal.z))),
  })
  return Object.freeze({
    position: placement.position,
    normal,
    up,
    right: Object.freeze({
      x: storeFloat(subtract(multiply(up.y, normal.z), multiply(up.z, normal.y))),
      y: storeFloat(subtract(multiply(up.z, normal.x), multiply(normal.z, up.x))),
      z: storeFloat(subtract(multiply(normal.y, up.x), multiply(up.y, normal.x))),
    }),
    width: placement.width,
    height: placement.height,
    depth: placement.depth,
  })
}

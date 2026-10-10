import type { FloatArithmetic, Vector2, Vector3 } from '../simulation-math.types.ts'

export const ZERO_VECTOR3: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 })

const ZERO_VECTOR2: Vector2 = Object.freeze({ x: 0, y: 0 })

// The race code's most common pattern: scale × each component, each product stored (FMUL, FSTP float).
export const getStoredScaledVector = (
  arithmetic: FloatArithmetic,
  vector: Vector3,
  scale: number
): Vector3 =>
  Object.freeze({
    x: arithmetic.storeFloat(arithmetic.multiply(scale, vector.x)),
    y: arithmetic.storeFloat(arithmetic.multiply(scale, vector.y)),
    z: arithmetic.storeFloat(arithmetic.multiply(scale, vector.z)),
  })

// left - right per component, each difference stored.
export const getStoredDifference = (
  arithmetic: FloatArithmetic,
  left: Vector3,
  right: Vector3
): Vector3 =>
  Object.freeze({
    x: arithmetic.storeFloat(arithmetic.subtract(left.x, right.x)),
    y: arithmetic.storeFloat(arithmetic.subtract(left.y, right.y)),
    z: arithmetic.storeFloat(arithmetic.subtract(left.z, right.z)),
  })

// left - right per component, kept unrounded (FSUB results consumed by further FPU operations).
export const getUnstoredDifference = (
  arithmetic: FloatArithmetic,
  left: Vector3,
  right: Vector3
): Vector3 => ({
  x: arithmetic.subtract(left.x, right.x),
  y: arithmetic.subtract(left.y, right.y),
  z: arithmetic.subtract(left.z, right.z),
})

// left + right per component, each sum stored.
export const getStoredSum = (arithmetic: FloatArithmetic, left: Vector3, right: Vector3): Vector3 =>
  Object.freeze({
    x: arithmetic.storeFloat(arithmetic.add(left.x, right.x)),
    y: arithmetic.storeFloat(arithmetic.add(left.y, right.y)),
    z: arithmetic.storeFloat(arithmetic.add(left.z, right.z)),
  })

// left × right with the operand order of 0x00404510 (also 0x00446fd0 and 0x00447230), each component stored.
export const getStoredCrossProduct = (
  arithmetic: FloatArithmetic,
  left: Vector3,
  right: Vector3
): Vector3 => {
  const { subtract, multiply, storeFloat } = arithmetic
  return Object.freeze({
    x: storeFloat(subtract(multiply(left.y, right.z), multiply(left.z, right.y))),
    y: storeFloat(subtract(multiply(left.z, right.x), multiply(right.z, left.x))),
    z: storeFloat(subtract(multiply(right.y, left.x), multiply(left.y, right.x))),
  })
}

// (left.z·right.z + left.y·right.y) + left.x·right.x, the grouping most of the race code's dot products use.
export const getDotProduct = (arithmetic: FloatArithmetic, left: Vector3, right: Vector3): number =>
  arithmetic.add(
    arithmetic.add(arithmetic.multiply(left.z, right.z), arithmetic.multiply(left.y, right.y)),
    arithmetic.multiply(left.x, right.x)
  )

// (z² + y²) + x², the grouping of the squared lengths in 0x00445dc0 and 0x004478b0.
export const getSquaredLength = (arithmetic: FloatArithmetic, vector: Vector3): number =>
  getDotProduct(arithmetic, vector, vector)

// 0x00449280 (fastcall: ECX source, EDX target). The zero test is FCOM against the double 0.0 at 0x004b0df0.
export const getNormalizedVector2 = (arithmetic: FloatArithmetic, vector: Vector2): Vector2 => {
  const { add, multiply, divide, getSquareRoot, storeFloat, getIsEqual } = arithmetic
  const length = getSquareRoot(add(multiply(vector.x, vector.x), multiply(vector.y, vector.y)))
  if (getIsEqual(length, 0)) return ZERO_VECTOR2
  const inverseLength = divide(1, length)
  return Object.freeze({
    x: storeFloat(multiply(inverseLength, vector.x)),
    y: storeFloat(multiply(inverseLength, vector.y)),
  })
}

// 0x004492d0 (fastcall: ECX source, EDX target; the target may be the source).
export const getNormalizedVector3 = (arithmetic: FloatArithmetic, vector: Vector3): Vector3 => {
  const { add, multiply, divide, getSquareRoot, storeFloat, getIsEqual } = arithmetic
  const length = getSquareRoot(
    add(
      add(multiply(vector.x, vector.x), multiply(vector.y, vector.y)),
      multiply(vector.z, vector.z)
    )
  )
  if (getIsEqual(length, 0)) return ZERO_VECTOR3
  const inverseLength = divide(1, length)
  return Object.freeze({
    x: storeFloat(multiply(inverseLength, vector.x)),
    y: storeFloat(multiply(inverseLength, vector.y)),
    z: storeFloat(multiply(inverseLength, vector.z)),
  })
}

// 0x004496a0 (cdecl: vector, target, axis, angle). FSIN's result is never stored; FCOS's is.
export const getVectorRotatedAroundAxis = (
  arithmetic: FloatArithmetic,
  vector: Vector3,
  axis: Vector3,
  angle: number
): Vector3 => {
  const { add, subtract, multiply, getSine, getCosine, storeFloat } = arithmetic
  const sine = getSine(angle)
  const cosine = storeFloat(getCosine(angle))
  const oneMinusCosine = storeFloat(subtract(1, cosine))
  const productXY = storeFloat(multiply(multiply(axis.y, axis.x), oneMinusCosine))
  const productXZ = storeFloat(multiply(multiply(axis.z, axis.x), oneMinusCosine))
  const productYZ = storeFloat(multiply(multiply(axis.z, axis.y), oneMinusCosine))
  const sineX = storeFloat(multiply(sine, axis.x))
  const sineY = storeFloat(multiply(axis.y, sine))
  const sineZ = multiply(sine, axis.z)
  const row0Column0 = storeFloat(add(multiply(multiply(axis.x, axis.x), oneMinusCosine), cosine))
  const row0Column1 = storeFloat(add(sineZ, productXY))
  const row0Column2 = storeFloat(subtract(productXZ, sineY))
  const row1Column0 = subtract(productXY, sineZ)
  const row1Column1 = add(multiply(multiply(axis.y, axis.y), oneMinusCosine), cosine)
  const row1Column2 = add(sineX, productYZ)
  const row2Column0 = storeFloat(add(sineY, productXZ))
  const row2Column1 = storeFloat(subtract(productYZ, sineX))
  const row2Column2 = storeFloat(add(multiply(multiply(axis.z, axis.z), oneMinusCosine), cosine))
  const getRotatedComponent = (fromX: number, fromY: number, fromZ: number): number =>
    storeFloat(
      add(add(multiply(vector.z, fromZ), multiply(vector.y, fromY)), multiply(vector.x, fromX))
    )
  return Object.freeze({
    x: getRotatedComponent(row0Column0, row0Column1, row0Column2),
    y: getRotatedComponent(row1Column0, row1Column1, row1Column2),
    z: getRotatedComponent(row2Column0, row2Column1, row2Column2),
  })
}

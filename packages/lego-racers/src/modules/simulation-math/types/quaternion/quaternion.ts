import type { FloatArithmetic, HalfRoot, Matrix3, Quaternion } from '../simulation-math.types.ts'

// 0x00449340 (cdecl: quaternion, target). Scales by 2 / |q|², so the quaternion need not be unit length.
export const getMatrixFromQuaternion = (
  arithmetic: FloatArithmetic,
  quaternion: Quaternion
): Matrix3 => {
  const { add, subtract, multiply, divide, storeFloat } = arithmetic
  const { x, y, z, w } = quaternion
  const lengthSquared = add(
    add(add(multiply(w, w), multiply(z, z)), multiply(y, y)),
    multiply(x, x)
  )
  const scale = divide(2, lengthSquared)
  const scaledX = storeFloat(multiply(scale, x))
  const scaledY = storeFloat(multiply(y, scale))
  const scaledZ = multiply(scale, z)
  const productWX = storeFloat(multiply(w, scaledX))
  const productWY = storeFloat(multiply(w, scaledY))
  const productWZ = storeFloat(multiply(w, scaledZ))
  const productXX = storeFloat(multiply(scaledX, x))
  const productXY = storeFloat(multiply(scaledY, x))
  const productXZ = storeFloat(multiply(scaledZ, x))
  const productYY = storeFloat(multiply(y, scaledY))
  const productYZ = storeFloat(multiply(y, scaledZ))
  const productZZ = multiply(scaledZ, z)
  return Object.freeze([
    storeFloat(subtract(1, add(productZZ, productYY))),
    storeFloat(subtract(productXY, productWZ)),
    storeFloat(add(productXZ, productWY)),
    storeFloat(add(productXY, productWZ)),
    storeFloat(subtract(1, add(productZZ, productXX))),
    storeFloat(subtract(productYZ, productWX)),
    storeFloat(subtract(productXZ, productWY)),
    storeFloat(add(productYZ, productWX)),
    storeFloat(subtract(1, add(productYY, productXX))),
  ])
}

// 0x00449460 (cdecl: matrix, target). Branches on the trace, then on the largest diagonal element.
export const getQuaternionFromMatrix = (
  arithmetic: FloatArithmetic,
  matrix: Matrix3
): Quaternion => {
  const { add, subtract, multiply, divide, getSquareRoot, storeFloat, getIsBelowOrEqual } =
    arithmetic
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = matrix
  const middleSum = add(m4, m8)
  // FST keeps the unrounded sum on the stack for the trace; the x branch reloads the stored copy.
  const storedMiddleSum = storeFloat(middleSum)
  const trace = add(middleSum, m0)
  const getHalfRoot = (radicand: number): HalfRoot => {
    const root = getSquareRoot(add(radicand, 1))
    return { half: storeFloat(multiply(root, 0.5)), factor: divide(0.5, root) }
  }
  const getScaled = (value: number, factor: number): number => storeFloat(multiply(value, factor))
  if (!getIsBelowOrEqual(trace, 0)) {
    const { half, factor } = getHalfRoot(trace)
    return Object.freeze({
      x: getScaled(subtract(m7, m5), factor),
      y: getScaled(subtract(m2, m6), factor),
      z: getScaled(subtract(m3, m1), factor),
      w: half,
    })
  }
  const largerOfFirstTwo = getIsBelowOrEqual(m4, m0) ? 0 : 1
  const largestDiagonal = getIsBelowOrEqual(m8, largerOfFirstTwo === 0 ? m0 : m4)
    ? largerOfFirstTwo
    : 2
  if (largestDiagonal === 0) {
    const { half, factor } = getHalfRoot(subtract(m0, storedMiddleSum))
    return Object.freeze({
      x: half,
      y: getScaled(add(m3, m1), factor),
      z: getScaled(add(m6, m2), factor),
      w: getScaled(subtract(m7, m5), factor),
    })
  }
  if (largestDiagonal === 1) {
    const { half, factor } = getHalfRoot(subtract(m4, add(m0, m8)))
    return Object.freeze({
      x: getScaled(add(m3, m1), factor),
      y: half,
      z: getScaled(add(m7, m5), factor),
      w: getScaled(subtract(m2, m6), factor),
    })
  }
  const { half, factor } = getHalfRoot(subtract(m8, add(m4, m0)))
  return Object.freeze({
    x: getScaled(add(m6, m2), factor),
    y: getScaled(add(m7, m5), factor),
    z: half,
    w: getScaled(subtract(m3, m1), factor),
  })
}

// 0x004495e0 (cdecl: from, to, fraction, target): linear, toward -to when the dot product is not positive.
export const getBlendedQuaternion = (
  arithmetic: FloatArithmetic,
  from: Quaternion,
  to: Quaternion,
  fraction: number
): Quaternion => {
  const { add, subtract, multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  const dot = add(
    add(add(multiply(from.y, to.y), multiply(from.z, to.z)), multiply(from.w, to.w)),
    multiply(from.x, to.x)
  )
  const getComponent = getIsBelowOrEqual(dot, 0)
    ? (start: number, end: number): number =>
        storeFloat(subtract(start, multiply(add(start, end), fraction)))
    : (start: number, end: number): number =>
        storeFloat(add(multiply(subtract(end, start), fraction), start))
  return Object.freeze({
    x: getComponent(from.x, to.x),
    y: getComponent(from.y, to.y),
    z: getComponent(from.z, to.z),
    w: getComponent(from.w, to.w),
  })
}

import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import type { Matrix3 } from '../simulation-math.types.ts'
import {
  getBlendedQuaternion,
  getMatrixFromQuaternion,
  getQuaternionFromMatrix,
} from './quaternion.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const DOUBLE = createFloatArithmetic(FpuPrecision.DOUBLE)

describe('getMatrixFromQuaternion', () => {
  it('returns the identity for the identity quaternion', () => {
    // Arrange
    const quaternion = { x: 0, y: 0, z: 0, w: 1 }

    // Act
    const matrix = getMatrixFromQuaternion(SINGLE, quaternion)

    // Assert
    expect(matrix).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })

  it('scales by 2 / |q|², so (0, 0, 1, 1) is a quarter turn around z', () => {
    // Arrange: |q|² = 2, so the scale is 1 and every product is exact.
    const quaternion = { x: 0, y: 0, z: 1, w: 1 }

    // Act
    const matrix = getMatrixFromQuaternion(SINGLE, quaternion)

    // Assert
    expect(matrix).toEqual([0, -1, 0, 1, 0, 0, 0, 0, 1])
  })
})

describe('getQuaternionFromMatrix', () => {
  it('uses the trace branch for the identity', () => {
    // Arrange
    const matrix: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

    // Act
    const quaternion = getQuaternionFromMatrix(SINGLE, matrix)

    // Assert
    expect(quaternion).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('recovers a quarter turn around z', () => {
    // Arrange: trace 1, root √2, w = √2 / 2 and z = 2 · 0.5 / √2, both 0x3f3504f3.
    const matrix: Matrix3 = [0, -1, 0, 1, 0, 0, 0, 0, 1]

    // Act
    const single = getQuaternionFromMatrix(SINGLE, matrix)
    const double = getQuaternionFromMatrix(DOUBLE, matrix)

    // Assert
    const expected = { x: 0, y: 0, z: Math.fround(Math.SQRT1_2), w: Math.fround(Math.SQRT1_2) }
    expect(single).toEqual(expected)
    expect(double).toEqual(expected)
  })

  it('takes the x branch when the first diagonal element is largest', () => {
    // Arrange: trace -1; root of (1 - (-2)) + 1 is 2.
    const matrix: Matrix3 = [1, 0, 0, 0, -1, 0, 0, 0, -1]

    // Act
    const quaternion = getQuaternionFromMatrix(SINGLE, matrix)

    // Assert
    expect(quaternion).toEqual({ x: 1, y: 0, z: 0, w: 0 })
  })

  it('takes the y branch when the middle diagonal element is largest', () => {
    // Arrange
    const matrix: Matrix3 = [-1, 0, 0, 0, 1, 0, 0, 0, -1]

    // Act
    const quaternion = getQuaternionFromMatrix(SINGLE, matrix)

    // Assert
    expect(quaternion).toEqual({ x: 0, y: 1, z: 0, w: 0 })
  })

  it('takes the z branch when the last diagonal element is largest', () => {
    // Arrange
    const matrix: Matrix3 = [-1, 0, 0, 0, -1, 0, 0, 0, 1]

    // Act
    const quaternion = getQuaternionFromMatrix(SINGLE, matrix)

    // Assert
    expect(quaternion).toEqual({ x: 0, y: 0, z: 1, w: 0 })
  })

  it('keeps the x branch when the first two diagonal elements tie', () => {
    // Arrange: m4 <= m0 keeps index 0, and m8 <= m0 keeps it again.
    const matrix: Matrix3 = [-1, 0, 0, 0, -1, 0, 0, 0, -1]

    // Act
    const quaternion = getQuaternionFromMatrix(SINGLE, matrix)

    // Assert: root of (-1 - (-2)) + 1 is √2.
    expect(quaternion.x).toBe(Math.fround(Math.SQRT1_2))
  })
})

describe('getBlendedQuaternion', () => {
  it('interpolates linearly when the dot product is positive', () => {
    // Arrange
    const from = { x: 0, y: 0, z: 0, w: 1 }
    const to = { x: 0, y: 0, z: 1, w: 1 }

    // Act
    const blended = getBlendedQuaternion(SINGLE, from, to, 0.5)

    // Assert
    expect(blended).toEqual({ x: 0, y: 0, z: 0.5, w: 1 })
  })

  it('interpolates toward the negated target when the dot product is zero or less', () => {
    // Arrange
    const from = { x: 0, y: 0, z: 0, w: 1 }
    const to = { x: 0, y: 0, z: 1, w: 0 }

    // Act
    const blended = getBlendedQuaternion(SINGLE, from, to, 0.5)

    // Assert
    expect(blended).toEqual({ x: 0, y: 0, z: -0.5, w: 0.5 })
  })
})

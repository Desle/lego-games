import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import type { Matrix3 } from '../simulation-math.types.ts'
import { getMatrixInFrame, getMatrixProduct, IDENTITY_MATRIX3 } from './matrix.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

describe('getMatrixProduct', () => {
  it('multiplies rows of the left matrix by columns of the right one', () => {
    // Arrange
    const left: Matrix3 = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const right: Matrix3 = [9, 8, 7, 6, 5, 4, 3, 2, 1]

    // Act
    const product = getMatrixProduct(SINGLE, left, right)

    // Assert
    expect(product).toEqual([30, 24, 18, 84, 69, 54, 138, 114, 90])
  })

  it('keeps a matrix multiplied by the identity', () => {
    // Arrange
    const matrix: Matrix3 = [1, 2, 3, 4, 5, 6, 7, 8, 9]

    // Act
    const product = getMatrixProduct(SINGLE, matrix, IDENTITY_MATRIX3)

    // Assert
    expect(product).toEqual(matrix)
  })

  it('adds the terms in the order of 0x00449190, which matters under 24-bit precision', () => {
    // Arrange: element 0 adds k=1 and k=2 first, element 4 adds k=2 and k=0 first.
    // Left to right, 1 + 2^24 would round to 2^24 and both elements would be 0.
    const left: Matrix3 = [1, 2 ** 24, -(2 ** 24), 2 ** 24, 1, -(2 ** 24), 0, 0, 0]
    const right: Matrix3 = [1, 1, 0, 1, 1, 0, 1, 1, 0]

    // Act
    const product = getMatrixProduct(SINGLE, left, right)

    // Assert
    expect(product[0]).toBe(1)
    expect(product[4]).toBe(1)
  })
})

describe('getMatrixInFrame', () => {
  it('returns transpose(rotation) * matrix * rotation', () => {
    // Arrange: a quarter turn swaps the first two axes of a diagonal inertia.
    const rotation: Matrix3 = [0, 1, 0, -1, 0, 0, 0, 0, 1]
    const matrix: Matrix3 = [1, 0, 0, 0, 2, 0, 0, 0, 3]

    // Act
    const result = getMatrixInFrame(SINGLE, rotation, matrix)

    // Assert
    expect(result).toEqual([2, 0, 0, 0, 1, 0, 0, 0, 3])
  })
})

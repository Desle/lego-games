import type { FloatArithmetic, Matrix3 } from '../simulation-math.types.ts'

// For element i of a product, the index k (of sum over k of left[row][k] * right[k][column]) added last.
const MATRIX_PRODUCT_LAST_TERMS: Matrix3 = [0, 0, 0, 0, 1, 1, 0, 1, 0]
const TRANSPOSE_PRODUCT_LAST_TERMS: Matrix3 = [0, 0, 0, 0, 1, 1, 0, 1, 1]

export const IDENTITY_MATRIX3: Matrix3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1])

const getElement = (matrix: Matrix3, row: number, column: number): number =>
  matrix[row * 3 + column] ?? 0

const getOrderedSum = (
  arithmetic: FloatArithmetic,
  getTerm: (index: number) => number,
  lastIndex: number
): number => {
  const [firstIndex, secondIndex] = [0, 1, 2].filter((index) => index !== lastIndex)
  return arithmetic.add(
    arithmetic.add(getTerm(firstIndex ?? 0), getTerm(secondIndex ?? 0)),
    getTerm(lastIndex)
  )
}

const getStoredMatrix = (
  arithmetic: FloatArithmetic,
  getValue: (row: number, column: number) => number
): Matrix3 =>
  Object.freeze([
    arithmetic.storeFloat(getValue(0, 0)),
    arithmetic.storeFloat(getValue(0, 1)),
    arithmetic.storeFloat(getValue(0, 2)),
    arithmetic.storeFloat(getValue(1, 0)),
    arithmetic.storeFloat(getValue(1, 1)),
    arithmetic.storeFloat(getValue(1, 2)),
    arithmetic.storeFloat(getValue(2, 0)),
    arithmetic.storeFloat(getValue(2, 1)),
    arithmetic.storeFloat(getValue(2, 2)),
  ])

// 0x00449190 (cdecl: left, right, target): left * right, each element summed on the FPU stack and stored once.
export const getMatrixProduct = (
  arithmetic: FloatArithmetic,
  left: Matrix3,
  right: Matrix3
): Matrix3 =>
  getStoredMatrix(arithmetic, (row, column) =>
    getOrderedSum(
      arithmetic,
      (index) =>
        arithmetic.multiply(getElement(left, row, index), getElement(right, index, column)),
      MATRIX_PRODUCT_LAST_TERMS[row * 3 + column] ?? 0
    )
  )

// Frame method 0x00410f30 (thiscall: matrix, target): transpose(rotation) * matrix * rotation, rotation at frame +0x28.
export const getMatrixInFrame = (
  arithmetic: FloatArithmetic,
  rotation: Matrix3,
  matrix: Matrix3
): Matrix3 => {
  const transposeProduct = getStoredMatrix(arithmetic, (row, column) =>
    getOrderedSum(
      arithmetic,
      (index) =>
        arithmetic.multiply(getElement(rotation, index, row), getElement(matrix, index, column)),
      TRANSPOSE_PRODUCT_LAST_TERMS[row * 3 + column] ?? 0
    )
  )
  return getMatrixProduct(arithmetic, transposeProduct, rotation)
}

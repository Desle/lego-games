import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import { createFloatArithmetic } from './float-arithmetic.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const DOUBLE = createFloatArithmetic(FpuPrecision.DOUBLE)

describe('createFloatArithmetic', () => {
  it('rounds every operation to float32 under 24-bit precision', () => {
    // Arrange
    const smallerThanHalfAnUnit = 2 ** -30

    // Act
    const sum = SINGLE.add(1, smallerThanHalfAnUnit)
    const quotient = SINGLE.divide(1, 3)

    // Assert
    expect(sum).toBe(1)
    expect(quotient).toBe(Math.fround(1 / 3))
  })

  it('keeps double results under 53-bit precision until a value is stored', () => {
    // Arrange
    const smallerThanHalfAnUnit = 2 ** -30

    // Act
    const sum = DOUBLE.add(1, smallerThanHalfAnUnit)
    const stored = DOUBLE.storeFloat(sum)

    // Assert
    expect(sum).toBe(1 + 2 ** -30)
    expect(stored).toBe(1)
  })

  it('rounds a square root once, the way FSQRT does', () => {
    // Arrange
    const two = 2

    // Act
    const singleRoot = SINGLE.getSquareRoot(two)
    const doubleRoot = DOUBLE.getSquareRoot(two)

    // Assert
    expect(singleRoot).toBe(Math.fround(Math.SQRT2))
    expect(doubleRoot).toBe(Math.SQRT2)
  })

  it('does not round sine and cosine in either precision', () => {
    // Arrange
    const angle = 1

    // Act
    const sine = SINGLE.getSine(angle)
    const cosine = SINGLE.getCosine(angle)

    // Assert
    expect(sine).toBe(Math.sin(1))
    expect(cosine).toBe(Math.cos(1))
  })

  it('treats an unordered comparison as equal and below, like FCOM', () => {
    // Arrange
    const notANumber = Number.NaN

    // Act
    const results = [
      SINGLE.getIsEqual(notANumber, 0),
      SINGLE.getIsBelow(notANumber, 0),
      SINGLE.getIsBelowOrEqual(0, notANumber),
    ]

    // Assert
    expect(results).toEqual([true, true, true])
  })

  it('compares ordered values normally, with -0 equal to 0', () => {
    // Arrange
    const negativeZero = -0

    // Act
    const results = [
      DOUBLE.getIsEqual(negativeZero, 0),
      DOUBLE.getIsBelow(1, 1),
      DOUBLE.getIsBelowOrEqual(1, 1),
      DOUBLE.getIsBelow(2, 1),
    ]

    // Assert
    expect(results).toEqual([true, false, true, false])
  })
})

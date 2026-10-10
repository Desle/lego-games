import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import {
  getDotProduct,
  getNormalizedVector2,
  getNormalizedVector3,
  getStoredDifference,
  getStoredScaledVector,
  getStoredSum,
  getVectorRotatedAroundAxis,
} from './vector.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const DOUBLE = createFloatArithmetic(FpuPrecision.DOUBLE)

const getFloatFromBits = (bits: number): number =>
  new Float32Array(new Uint32Array([bits]).buffer)[0] ?? Number.NaN

describe('getNormalizedVector3', () => {
  it('divides by the length through one reciprocal', () => {
    // Arrange
    const vector = { x: 3, y: 4, z: 0 }

    // Act
    const normalized = getNormalizedVector3(SINGLE, vector)

    // Assert
    expect(normalized).toEqual({ x: Math.fround(0.6), y: Math.fround(0.8), z: 0 })
  })

  it('differs in the last bit between 24-bit and 53-bit precision', () => {
    // Arrange: sqrt(14) and 1/sqrt(14) round differently when kept on the stack.
    const vector = { x: 1, y: 2, z: 3 }

    // Act
    const single = getNormalizedVector3(SINGLE, vector)
    const double = getNormalizedVector3(DOUBLE, vector)

    // Assert
    expect(single.z).toBe(getFloatFromBits(0x3f4d41b2))
    expect(double.z).toBe(getFloatFromBits(0x3f4d41b3))
    expect(single.x).toBe(double.x)
  })

  it('returns zero for a zero vector', () => {
    // Arrange
    const vector = { x: 0, y: 0, z: 0 }

    // Act
    const normalized = getNormalizedVector3(DOUBLE, vector)

    // Assert
    expect(normalized).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('returns zero when the length is not a number, because FCOM reports it as equal', () => {
    // Arrange
    const vector = { x: Number.NaN, y: 1, z: 1 }

    // Act
    const normalized = getNormalizedVector3(SINGLE, vector)

    // Assert
    expect(normalized).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('getNormalizedVector2', () => {
  it('normalizes x and y', () => {
    // Arrange
    const vector = { x: 0, y: -4 }

    // Act
    const normalized = getNormalizedVector2(SINGLE, vector)

    // Assert
    expect(normalized).toEqual({ x: 0, y: -1 })
  })

  it('returns zero for a zero vector', () => {
    // Arrange
    const vector = { x: 0, y: 0 }

    // Act
    const normalized = getNormalizedVector2(SINGLE, vector)

    // Assert
    expect(normalized).toEqual({ x: 0, y: 0 })
  })
})

describe('getVectorRotatedAroundAxis', () => {
  it('keeps the vector for a zero angle', () => {
    // Arrange
    const vector = { x: 1, y: 2, z: 3 }
    const axis = { x: 0, y: 0, z: 1 }

    // Act
    const rotated = getVectorRotatedAroundAxis(SINGLE, vector, axis, 0)

    // Assert
    expect(rotated).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('turns x toward -y for a quarter turn around z', () => {
    // Arrange: cos(float32 π/2) is -4.371139e-8 (0xb33bbd2e), and 1 - cos rounds to 1.
    const vector = { x: 1, y: 0, z: 0 }
    const axis = { x: 0, y: 0, z: 1 }
    const quarterTurn = Math.fround(Math.PI / 2)

    // Act
    const single = getVectorRotatedAroundAxis(SINGLE, vector, axis, quarterTurn)
    const double = getVectorRotatedAroundAxis(DOUBLE, vector, axis, quarterTurn)

    // Assert
    const expected = { x: getFloatFromBits(0xb33bbd2e), y: -1, z: 0 }
    expect(single).toEqual(expected)
    expect(double).toEqual(expected)
  })
})

describe('stored vector helpers', () => {
  it('scale, subtract and add per component, and dot as (z·z + y·y) + x·x', () => {
    // Arrange
    const left = { x: 1, y: 2, z: 3 }
    const right = { x: 0.5, y: -1, z: 4 }

    // Act
    const results = {
      scaled: getStoredScaledVector(SINGLE, left, 2),
      difference: getStoredDifference(SINGLE, left, right),
      sum: getStoredSum(SINGLE, left, right),
      dot: getDotProduct(SINGLE, left, right),
    }

    // Assert
    expect(results).toEqual({
      scaled: { x: 2, y: 4, z: 6 },
      difference: { x: 0.5, y: 3, z: -1 },
      sum: { x: 1.5, y: 1, z: 7 },
      dot: 10.5,
    })
  })
})

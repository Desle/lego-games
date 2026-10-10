import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import { getSineCosine } from './sine-cosine.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

describe('getSineCosine', () => {
  it('returns 0 and 1 for a zero angle', () => {
    // Arrange
    const angle = 0

    // Act
    const result = getSineCosine(SINGLE, angle)

    // Assert
    expect(result).toEqual({ sine: 0, cosine: 1 })
  })

  it('stores both results as float32', () => {
    // Arrange: float32 π/2 is 4.371139e-8 above π/2, so its cosine is about -4.371139e-8.
    const angle = Math.fround(Math.PI / 2)

    // Act
    const result = getSineCosine(SINGLE, angle)

    // Assert
    expect(result.sine).toBe(1)
    expect(result.cosine).toBe(Math.fround(-4.371139000186241e-8))
  })
})

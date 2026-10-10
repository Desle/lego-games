import {
  getFixedPointValue,
  getSignedShort,
  getThousandthOf,
  getUnsignedByte,
  getUnsignedShort,
} from './binary-values.ts'

describe('binary values', () => {
  it('truncates integers to 16 and 8 bits', () => {
    // Arrange
    const value = 0x1_ff_ff

    // Act
    const truncated = [getSignedShort(value), getUnsignedShort(value), getUnsignedByte(value)]

    // Assert
    expect(truncated).toEqual([-1, 0xffff, 0xff])
  })

  it('scales integers by float32 0.001 and by 2^-30', () => {
    // Arrange
    const milliseconds = 30

    // Act
    const scaled = [getThousandthOf(milliseconds), getFixedPointValue(-(2 ** 30))]

    // Assert
    expect(scaled).toEqual([Math.fround(30 * Math.fround(0.001)), -1])
  })

  it('returns null where a double product could round differently from x87', () => {
    // Arrange
    const large = 2 ** 30

    // Act
    const scaled = getThousandthOf(large)

    // Assert
    expect(scaled).toBeNull()
  })
})

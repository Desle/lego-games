import { FLOAT32_MAXIMUM, getFloatFromBits, getTruncatedInteger } from './float-bits.ts'

describe('getFloatFromBits', () => {
  it('reads float32 constants from their bit patterns', () => {
    // Arrange
    const patterns = [0x3f800000, 0x3d23d70a, 0xc3ffc000, 0x40490fdb]

    // Act
    const values = patterns.map(getFloatFromBits)

    // Assert
    expect(values).toEqual([1, Math.fround(0.04), -511.5, Math.fround(Math.PI)])
    expect(FLOAT32_MAXIMUM).toBe(3.4028234663852886e38)
  })
})

describe('getTruncatedInteger', () => {
  it('truncates toward zero like _ftol', () => {
    // Arrange
    const values = [1.9, -1.9, -0.5, 1022.999]

    // Act
    const integers = values.map(getTruncatedInteger)

    // Assert
    expect(integers).toEqual([1, -1, 0, 1022])
  })
})

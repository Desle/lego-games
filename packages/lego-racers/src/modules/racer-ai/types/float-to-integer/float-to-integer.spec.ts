import { getFloatToInteger } from './float-to-integer.ts'

describe('getFloatToInteger', () => {
  it('truncates toward zero', () => {
    // Arrange
    const values = [2.9, -2.9, 0.5]

    // Act
    const integers = values.map(getFloatToInteger)

    // Assert
    expect(integers).toEqual([2, -2, 0])
  })

  it('keeps the low dword of the 64-bit result, and 0 for NaN', () => {
    // Arrange
    const values = [2 ** 32 + 5, Number.NaN]

    // Act
    const integers = values.map(getFloatToInteger)

    // Assert
    expect(integers).toEqual([5, 0])
  })
})

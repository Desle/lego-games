import { addVectors, getVectorDifference } from './builder-vectors.ts'

describe('builder vectors', () => {
  it('adds and subtracts by axis', () => {
    // Arrange
    const first = [1, -2, 3] as const
    const second = [10, 20, -30] as const

    // Act
    const sum = addVectors(first, second)
    const difference = getVectorDifference(first, second)

    // Assert
    expect(sum).toEqual([11, 18, -27])
    expect(difference).toEqual([-9, -22, 33])
  })
})

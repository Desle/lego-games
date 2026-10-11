import { getRowsReversed } from './scene-material.ts'

describe('getRowsReversed', () => {
  it('puts the last row of the picture first, keeping each row as it is', () => {
    // Arrange
    const colors = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])

    // Act
    const reversed = getRowsReversed(colors, 2, 2)

    // Assert
    expect([...reversed]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 1, 2, 3, 4, 5, 6, 7, 8])
  })
})

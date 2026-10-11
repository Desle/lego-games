import { getLanguageIndex } from './language-index.ts'

describe('getLanguageIndex', () => {
  it('maps the registry language to the language list and falls back to english', () => {
    // Arrange
    const identifiers = [0, 0x409, 0x07, 0x40c, 0x1d]

    // Act
    const indices = identifiers.map(getLanguageIndex)

    // Assert
    expect(indices).toEqual([0, 0, 3, 2, 6])
  })
})

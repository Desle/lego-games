import { describeLDrawModel } from './ldraw-model-description.ts'

describe('describeLDrawModel', () => {
  it('counts the parts of the main file and reads the opening comments', () => {
    // Arrange
    const text = [
      '0 FILE main.ldr',
      '0 Pilot car',
      '0 Author: someone',
      '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
      '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
      '0 FILE sub.ldr',
      '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
    ].join('\n')

    // Act
    const description = describeLDrawModel(text)

    // Assert
    expect(description).toEqual({ partCount: 2, headerLines: ['Pilot car', 'Author: someone'] })
  })

  it('has no parts and no header for an empty file', () => {
    // Arrange
    const text = ''

    // Act
    const description = describeLDrawModel(text)

    // Assert
    expect(description).toEqual({ partCount: 0, headerLines: [] })
  })
})

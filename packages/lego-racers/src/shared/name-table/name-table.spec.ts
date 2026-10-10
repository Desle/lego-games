import { DuplicateNameError } from '../errors/gol-file-errors.ts'
import { createNameTable } from './name-table.ts'

describe('createNameTable', () => {
  it('finds a name by its first eight characters', () => {
    // Arrange
    const table = createNameTable()
    table.add('longername', 3)

    // Act
    const found = [table.find('longerna'), table.find('longernameX'), table.find('other')]

    // Assert
    expect(found).toEqual([3, 3, null])
  })

  it('rejects a second name with the same first eight characters', () => {
    // Arrange
    const table = createNameTable()
    table.add('abcdefgh1', 0)

    // Act
    const add = () => table.add('abcdefgh2', 1)

    // Assert
    expect(add).toThrow(new DuplicateNameError('abcdefgh2'))
  })
})

import { IDENTITY_TABLES } from '../racer-fixtures/racer-fixtures.ts'
import { getTableCosine } from './cosine-table.ts'

describe('getTableCosine', () => {
  it('masks negative indices like the two’s complement & 0x3ff', () => {
    // Arrange
    const index = -1

    // Act
    const value = getTableCosine(IDENTITY_TABLES, index)

    // Assert
    expect(value).toBe(1023)
  })
})

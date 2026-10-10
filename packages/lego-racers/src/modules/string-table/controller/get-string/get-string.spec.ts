import { StringTableOverreadError } from '../../types/string-table-errors/string-table-errors.ts'
import { getString } from './get-string.ts'

const table = Object.freeze({
  offsets: Object.freeze([0, 3]),
  characters: Object.freeze([0x48, 0x69, 0, 0x263a, 0x41, 0]),
  readByteCount: 20,
})

describe('getString', () => {
  it('reads from the string offset up to the terminating zero', () => {
    // Arrange
    const index = 1

    // Act
    const value = getString(table, index)

    // Assert
    expect(value).toBe('☺A')
  })

  it('returns null only for an index above the count', () => {
    // Arrange
    const index = 3

    // Act
    const value = getString(table, index)

    // Assert
    expect(value).toBeNull()
  })

  it('refuses the index equal to the count, which the original reads past its offsets', () => {
    // Arrange
    const index = 2

    // Act
    const read = () => getString(table, index)

    // Assert
    expect(read).toThrow(StringTableOverreadError)
  })

  it('refuses a string without a terminating zero', () => {
    // Arrange
    const unterminated = Object.freeze({ ...table, characters: Object.freeze([0x48]) })

    // Act
    const read = () => getString(unterminated, 0)

    // Assert
    expect(read).toThrow(StringTableOverreadError)
  })
})

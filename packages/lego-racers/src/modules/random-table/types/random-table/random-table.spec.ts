import {
  InvalidRandomTableError,
  RandomDivisorError,
} from '../random-table-errors/random-table-errors.ts'
import {
  createRandomTable,
  createRandomTablePosition,
  decodeRandomTable,
  drawRandomLowByte,
  drawRandomRemainder,
  drawRandomScaledRange,
  drawRandomValue,
  getNextRandomTablePosition,
} from './random-table.ts'

// A synthetic table (the real one is game data): value = 1023 - index.
const TABLE = createRandomTable(Array.from({ length: 1024 }, (_, index) => 1023 - index))

describe('random table', () => {
  it('advances the position before reading, wrapping 1023 to 0 (AND 0x3ff)', () => {
    // Arrange
    const position = createRandomTablePosition(1023)

    // Act
    const draw = drawRandomValue(TABLE, position)

    // Assert
    expect(draw).toEqual({ position: 0, value: 1023 })
    expect(getNextRandomTablePosition(5)).toBe(6)
  })

  it('reduces modulo the divisor, as DIV and IDIV of the zero-extended value do', () => {
    // Arrange
    const position = createRandomTablePosition(9)

    // Act
    const draw = drawRandomRemainder(TABLE, position, 500)

    // Assert
    expect(draw).toEqual({ position: 10, value: 1013 % 500 })
  })

  it('refuses a zero divisor, where the original raises a divide error', () => {
    // Arrange
    const position = createRandomTablePosition(0)

    // Act
    const draw = (): unknown => drawRandomRemainder(TABLE, position, 0)

    // Assert
    expect(draw).toThrow(RandomDivisorError)
  })

  it('keeps only the low byte for the byte reads (MOV r8,byte ptr)', () => {
    // Arrange
    const position = createRandomTablePosition(0)

    // Act
    const draw = drawRandomLowByte(TABLE, position)

    // Assert
    expect(draw).toEqual({ position: 1, value: 1022 & 0xff })
  })

  it('scales by range / 1023 from a range of 0x400 on, and reduces below it', () => {
    // Arrange
    const position = createRandomTablePosition(0)

    // Act
    const scaled = drawRandomScaledRange(TABLE, position, 5000)
    const reduced = drawRandomScaledRange(TABLE, position, 1023)

    // Assert
    expect(scaled).toEqual({ position: 1, value: 4 * 1022 })
    expect(reduced).toEqual({ position: 1, value: 1022 % 1023 })
  })

  it('decodes little-endian uint16 values and rejects values above 1023', () => {
    // Arrange
    const bytes = new Uint8Array(2048)
    bytes[0] = 0xff
    bytes[1] = 0x03
    const invalidBytes = new Uint8Array(2048)
    invalidBytes[1] = 0x04

    // Act
    const table = decodeRandomTable(bytes)
    const decodeInvalid = (): unknown => decodeRandomTable(invalidBytes)

    // Assert
    expect(table.values[0]).toBe(1023)
    expect(decodeInvalid).toThrow(InvalidRandomTableError)
  })
})

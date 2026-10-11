import { SaveFileFailure } from '../../types/save-errors/save-errors.ts'
import { getBlockChecksum, readSaveBlocks, writeSaveBlocks } from './save-blocks.ts'

describe('save blocks', () => {
  it('sums bytes modulo 256', () => {
    // Arrange
    const bytes = new Uint8Array([200, 100, 3])

    // Act
    const checksum = getBlockChecksum(bytes, 0, 3)

    // Assert
    expect(checksum).toBe(47)
  })

  it('splits data into 127-byte blocks, pads the last one and appends each sum', () => {
    // Arrange
    const data = Uint8Array.from({ length: 130 }, (_, index) => index + 1)

    // Act
    const bytes = writeSaveBlocks(data)

    // Assert
    expect(bytes.byteLength).toBe(256)
    expect(bytes[127]).toBe(getBlockChecksum(data, 0, 127))
    expect(bytes[128]).toBe(128)
    expect(bytes[128 + 3]).toBe(0)
    expect(bytes[255]).toBe((128 + 129 + 130) & 0xff)
  })

  it('reads back what was written and reports where the next block starts', () => {
    // Arrange
    const data = Uint8Array.from({ length: 300 }, (_, index) => (index * 7) & 0xff)
    const bytes = writeSaveBlocks(data)

    // Act
    const read = readSaveBlocks(bytes, 0, 300)

    // Assert
    expect(read.data).toEqual(data)
    expect(read.nextPosition).toBe(384)
  })

  it('refuses a block with a wrong sum and a position past the end', () => {
    // Arrange
    const bytes = writeSaveBlocks(new Uint8Array(127))
    bytes[127] = 1

    // Act
    const corrupt = () => readSaveBlocks(bytes, 0, 127)
    const missing = () => readSaveBlocks(bytes, 128, 1)

    // Assert
    expect(corrupt).toThrow(SaveFileFailure.CORRUPT_BLOCK)
    expect(missing).toThrow(SaveFileFailure.TRUNCATED)
  })
})

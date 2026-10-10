import { InvalidBitmapError } from '../bitmap-errors/bitmap-errors.ts'
import type { BitmapBlockReader } from '../bitmap.types.ts'

// The engine decodes every block in one 1500-byte buffer (GolDP.dll, bitmap object + 0x8f0).
export const BITMAP_BLOCK_BUFFER_LENGTH = 0x5dc
const BLOCK_HEADER_LENGTH = 4
const MINIMUM_MATCH_LENGTH_BASE = 0x12

const readUnsignedShort = (file: Uint8Array, position: number): number => {
  if (position + 2 > file.byteLength) throw new InvalidBitmapError('Unexpected end of BMP data')
  return (file[position] ?? 0) | ((file[position + 1] ?? 0) << 8)
}

export const createBitmapBlockReader = (): BitmapBlockReader => {
  const buffer = new Uint8Array(BITMAP_BLOCK_BUFFER_LENGTH)
  let pendingStart = 0
  let pendingLength = 0

  const readBufferByte = (index: number): number => buffer[index] ?? 0

  const writeBufferByte = (index: number, value: number): void => {
    if (index >= BITMAP_BLOCK_BUFFER_LENGTH) throw new InvalidBitmapError('BMP block overflow')
    buffer[index] = value
  }

  // LZSS at GolDP.dll 0x10032840: MSB-first flag bytes, a set bit is a back-reference.
  const decompress = (sourceStart: number): number => {
    let source = sourceStart
    let destination = 0
    writeBufferByte(destination++, readBufferByte(source++))
    for (;;) {
      const flags = readBufferByte(source++)
      for (let bit = 7; bit >= 0; bit--) {
        if (((flags >> bit) & 1) === 0) {
          writeBufferByte(destination++, readBufferByte(source++))
          continue
        }
        const token = readBufferByte(source++)
        const lengthCode = token & 0xf
        const distance = ((token >> 4) << 8) | readBufferByte(source)
        // A zero length nibble reads one more byte, before the end-of-stream check, as the original does.
        const length =
          lengthCode === 0
            ? readBufferByte(source + 1) + MINIMUM_MATCH_LENGTH_BASE
            : MINIMUM_MATCH_LENGTH_BASE - lengthCode
        source += lengthCode === 0 ? 2 : 1
        if (distance === 0) return destination
        for (let copied = 0; copied < length; copied++) {
          writeBufferByte(destination, readBufferByte(destination - distance))
          destination++
        }
      }
    }
  }

  const readBlock = (file: Uint8Array, position: number): number => {
    const decompressedLength = readUnsignedShort(file, position)
    const compressedLength = readUnsignedShort(file, position + 2)
    const dataStart = position + BLOCK_HEADER_LENGTH
    const storedLength = Math.min(compressedLength, decompressedLength)
    if (
      decompressedLength > BITMAP_BLOCK_BUFFER_LENGTH ||
      dataStart + storedLength > file.byteLength
    ) {
      throw new InvalidBitmapError('Unexpected end of BMP data')
    }
    if (compressedLength < decompressedLength) {
      const sourceStart = BITMAP_BLOCK_BUFFER_LENGTH - compressedLength
      buffer.set(file.subarray(dataStart, dataStart + compressedLength), sourceStart)
      decompress(sourceStart)
    } else {
      buffer.set(file.subarray(dataStart, dataStart + decompressedLength), 0)
    }
    pendingStart = 0
    pendingLength = decompressedLength
    return dataStart + storedLength
  }

  // GolDP.dll 0x10019fe0: a row takes leftover bytes of the previous block first, then reads blocks.
  const readRow = (file: Uint8Array, startPosition: number, row: Uint8Array): number => {
    let position = startPosition
    let filled = 0
    while (filled < row.byteLength) {
      if (pendingLength === 0) position = readBlock(file, position)
      const taken = Math.min(pendingLength, row.byteLength - filled)
      row.set(buffer.subarray(pendingStart, pendingStart + taken), filled)
      filled += taken
      pendingStart += taken
      pendingLength -= taken
    }
    return position
  }

  return Object.freeze({ readRow })
}

import { InvalidBitmapError } from '../bitmap-errors/bitmap-errors.ts'
import type { BitmapBlockReader } from '../bitmap.types.ts'
import { decompressLzss } from '../lzss-decompressor/lzss-decompressor.ts'

// The engine decodes every block in one 1500-byte buffer (GolDP.dll, bitmap object + 0x8f0).
export const BITMAP_BLOCK_BUFFER_LENGTH = 0x5dc
const BLOCK_HEADER_LENGTH = 4

const readUnsignedShort = (file: Uint8Array, position: number): number => {
  if (position + 2 > file.byteLength) throw new InvalidBitmapError('Unexpected end of BMP data')
  return (file[position] ?? 0) | ((file[position + 1] ?? 0) << 8)
}

export const createBitmapBlockReader = (): BitmapBlockReader => {
  const buffer = new Uint8Array(BITMAP_BLOCK_BUFFER_LENGTH)
  let pendingStart = 0
  let pendingLength = 0

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
      decompressLzss(buffer, sourceStart)
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

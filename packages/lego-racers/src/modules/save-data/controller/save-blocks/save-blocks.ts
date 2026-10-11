import { getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import { SaveFileError, SaveFileFailure } from '../../types/save-errors/save-errors.ts'
import { BLOCK_BYTE_COUNT, BLOCK_DATA_BYTE_COUNT } from '../../types/save-layout/save-layout.ts'
import type { SaveBlockRead } from './save-blocks.types.ts'

// FUN_004429d0: the sum of the bytes. The blocks keep its low byte.
export const getBlockChecksum = (bytes: Uint8Array, start: number, count: number): number => {
  let sum = 0
  for (let index = 0; index < count; index += 1) sum += bytes[start + index] ?? 0
  return getUnsignedByte(sum)
}

// FUN_00442910: reads blocks from `position` until `length` bytes of data are in, 0x7f of each block, and stops at
// a block whose length is short or whose last byte is not the sum of the other 0x7f.
export const readSaveBlocks = (
  bytes: Uint8Array,
  position: number,
  length: number
): SaveBlockRead => {
  const data = new Uint8Array(length)
  let nextPosition = position
  for (let copied = 0; copied < length; copied += BLOCK_DATA_BYTE_COUNT) {
    const available = bytes.byteLength - nextPosition
    if (available <= 0) {
      throw new SaveFileError(SaveFileFailure.TRUNCATED, `no block at ${String(nextPosition)}`)
    }
    const isSumMatching =
      available >= BLOCK_BYTE_COUNT &&
      getBlockChecksum(bytes, nextPosition, BLOCK_DATA_BYTE_COUNT) ===
        bytes[nextPosition + BLOCK_DATA_BYTE_COUNT]
    if (!isSumMatching) {
      throw new SaveFileError(
        SaveFileFailure.CORRUPT_BLOCK,
        `the block at ${String(nextPosition)} does not match its sum`
      )
    }
    const count = Math.min(length - copied, BLOCK_DATA_BYTE_COUNT)
    data.set(bytes.subarray(nextPosition, nextPosition + count), copied)
    nextPosition += BLOCK_BYTE_COUNT
  }
  return Object.freeze({ data, nextPosition })
}

// FUN_00442840: splits data into blocks of 0x7f bytes, the last one padded with zeros, each followed by its sum.
export const writeSaveBlocks = (data: Uint8Array): Uint8Array => {
  const blockCount = Math.ceil(data.byteLength / BLOCK_DATA_BYTE_COUNT)
  const bytes = new Uint8Array(blockCount * BLOCK_BYTE_COUNT)
  for (let block = 0; block < blockCount; block += 1) {
    const start = block * BLOCK_BYTE_COUNT
    const source = data.subarray(block * BLOCK_DATA_BYTE_COUNT, (block + 1) * BLOCK_DATA_BYTE_COUNT)
    bytes.set(source, start)
    bytes[start + BLOCK_DATA_BYTE_COUNT] = getBlockChecksum(bytes, start, BLOCK_DATA_BYTE_COUNT)
  }
  return bytes
}

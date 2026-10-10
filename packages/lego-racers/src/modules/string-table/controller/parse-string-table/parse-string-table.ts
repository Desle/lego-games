import { TruncatedStringTableError } from '../../types/string-table-errors/string-table-errors.ts'
import type { StringTable } from '../../types/string-table.types.ts'

const HEADER_BYTE_COUNT = 4

const readUnsignedShorts = (view: DataView, offset: number, count: number): readonly number[] =>
  Object.freeze(
    Array.from({ length: count }, (_, index) => view.getUint16(offset + index * 2, true))
  )

// LEGORacers.exe 0x0044e2c0: uint16 count, uint16 character count, count offsets, then the characters.
export const parseStringTable = (bytes: Uint8Array): StringTable => {
  if (bytes.byteLength < HEADER_BYTE_COUNT) {
    throw new TruncatedStringTableError(HEADER_BYTE_COUNT, bytes.byteLength)
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const stringCount = view.getUint16(0, true)
  const characterCount = view.getUint16(2, true)
  const charactersOffset = HEADER_BYTE_COUNT + stringCount * 2
  const readByteCount = charactersOffset + characterCount * 2
  if (bytes.byteLength < readByteCount) {
    throw new TruncatedStringTableError(readByteCount, bytes.byteLength)
  }
  return Object.freeze({
    offsets: readUnsignedShorts(view, HEADER_BYTE_COUNT, stringCount),
    characters: readUnsignedShorts(view, charactersOffset, characterCount),
    readByteCount,
  })
}

import type { LogicalBytes } from '../../types/car-builder.types.ts'
import type { SaveFile, SaveRacerRecord } from '../../types/save-file.types.ts'
import { SaveFileError } from '../../types/save-file-error.ts'

// SaveFile_Parse 0x00442770 and 0x00442910: the file is read in blocks of 0x80 bytes, 0x7f bytes of data and one byte
// holding their sum (0x004429d0, compared as a byte).
const BLOCK_BYTE_COUNT = 0x80
const BLOCK_DATA_BYTE_COUNT = 0x7f
const HEADER_BYTE_COUNT = 0x477
const RECORD_BYTE_COUNT = 0x22d
const RACER_COUNT_OFFSET = 2
const NAME_CHARACTER_COUNT = 13
const PART_OFFSET = 0x1c
const PART_COUNT = 5
const CHASSIS_NAME_OFFSET = 0x21
const CHASSIS_NAME_LENGTH = 8
const DESIGN_OFFSET = 0x29
const SIGNATURE_FIRST = 'L'.charCodeAt(0)
const SIGNATURE_SECOND = 'R'.charCodeAt(0)
const BLOCK_CHECKSUM_FAILED = 0x11

// 0x00442910: the next `length` logical bytes from the block at `position`, which must start a block; each block's
// checksum is verified. Returns the bytes and the position after the last block read.
const readLogicalBytes = (bytes: Uint8Array, start: number, length: number): LogicalBytes => {
  const data = new Uint8Array(length)
  let position = start
  for (let copied = 0; copied < length; copied += BLOCK_DATA_BYTE_COUNT) {
    const block = bytes.subarray(position, position + BLOCK_BYTE_COUNT)
    if (block.length !== BLOCK_BYTE_COUNT) throw new SaveFileError(BLOCK_CHECKSUM_FAILED)
    const checksum = block.subarray(0, BLOCK_DATA_BYTE_COUNT).reduce((sum, value) => sum + value, 0)
    if ((checksum & 0xff) !== block[BLOCK_DATA_BYTE_COUNT]) {
      throw new SaveFileError(BLOCK_CHECKSUM_FAILED)
    }
    data.set(block.subarray(0, Math.min(BLOCK_DATA_BYTE_COUNT, length - copied)), copied)
    position += BLOCK_BYTE_COUNT
  }
  return { data, end: position }
}

const getText = (bytes: Uint8Array, offset: number, length: number): string => {
  const end = bytes.subarray(offset, offset + length).indexOf(0)
  return String.fromCharCode(...bytes.subarray(offset, end < 0 ? offset + length : offset + end))
}

const getWideName = (record: Uint8Array): string => {
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength)
  const characters: number[] = []
  for (let index = 0; index < NAME_CHARACTER_COUNT; index += 1) {
    const character = view.getUint16(index * 2, true)
    if (character === 0) break
    characters.push(character)
  }
  return String.fromCharCode(...characters)
}

const getRecord = (data: Uint8Array): SaveRacerRecord =>
  Object.freeze({
    name: getWideName(data),
    partBytes: Object.freeze(Array.from(data.subarray(PART_OFFSET, PART_OFFSET + PART_COUNT))),
    chassisName: getText(data, CHASSIS_NAME_OFFSET, CHASSIS_NAME_LENGTH),
    designBytes: data.slice(DESIGN_OFFSET),
  })

// A racer save (`default.lrs`, `qbuild.lrs`, SaveFile_Parse 0x00442770): the signature "LR", the racer count (byte 2) in
// a header of 0x477 data bytes, then each racer as a record of 0x22d data bytes starting on a block boundary. A record
// is the name (13 UTF-16 characters), the five bytes the figure builder takes (+0x1c), the chassis name (+0x21) and
// the design (+0x29).
export const parseSaveFile = (bytes: Uint8Array): SaveFile => {
  const header = readLogicalBytes(bytes, 0, HEADER_BYTE_COUNT)
  if (header.data[0] !== SIGNATURE_FIRST || header.data[1] !== SIGNATURE_SECOND) {
    throw new SaveFileError(BLOCK_CHECKSUM_FAILED)
  }
  const racerCount = header.data[RACER_COUNT_OFFSET] ?? 0
  const racers: SaveRacerRecord[] = []
  let position = header.end
  for (let index = 0; index < racerCount; index += 1) {
    const record = readLogicalBytes(bytes, position, RECORD_BYTE_COUNT)
    racers.push(getRecord(record.data))
    position = record.end
  }
  return Object.freeze({ racers: Object.freeze(racers) })
}

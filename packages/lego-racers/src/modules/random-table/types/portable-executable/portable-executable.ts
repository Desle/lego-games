import { PortableExecutableError } from '../random-table-errors/random-table-errors.ts'
import type { PortableExecutableLayout, PortableExecutableSection } from '../random-table.types.ts'

const DOS_HEADER_NEW_HEADER_OFFSET = 0x3c
const PE_SIGNATURE = 0x00004550
const SECTION_COUNT_OFFSET = 6
const OPTIONAL_HEADER_SIZE_OFFSET = 20
const OPTIONAL_HEADER_OFFSET = 24
const PE32_MAGIC = 0x10b
const IMAGE_BASE_OFFSET = 28
const SECTION_HEADER_SIZE = 40
const SECTION_NAME_LENGTH = 8

const getView = (executable: Uint8Array): DataView =>
  new DataView(executable.buffer, executable.byteOffset, executable.byteLength)

const getIsInside = (executable: Uint8Array, offset: number, length: number): boolean =>
  offset >= 0 && offset + length <= executable.byteLength

const getSectionName = (executable: Uint8Array, offset: number): string => {
  const nameBytes = executable.subarray(offset, offset + SECTION_NAME_LENGTH)
  const terminator = nameBytes.indexOf(0)
  return String.fromCharCode(...(terminator === -1 ? nameBytes : nameBytes.subarray(0, terminator)))
}

const getSection = (
  executable: Uint8Array,
  view: DataView,
  offset: number
): PortableExecutableSection =>
  Object.freeze({
    name: getSectionName(executable, offset),
    virtualSize: view.getUint32(offset + 8, true),
    virtualAddress: view.getUint32(offset + 12, true),
    rawDataSize: view.getUint32(offset + 16, true),
    rawDataOffset: view.getUint32(offset + 20, true),
  })

export const getPortableExecutableLayout = (executable: Uint8Array): PortableExecutableLayout => {
  const view = getView(executable)
  if (!getIsInside(executable, DOS_HEADER_NEW_HEADER_OFFSET, 4)) {
    throw new PortableExecutableError('File too small for a DOS header')
  }
  const headerOffset = view.getUint32(DOS_HEADER_NEW_HEADER_OFFSET, true)
  if (
    !getIsInside(executable, headerOffset, OPTIONAL_HEADER_OFFSET + IMAGE_BASE_OFFSET + 4) ||
    view.getUint32(headerOffset, true) !== PE_SIGNATURE
  ) {
    throw new PortableExecutableError('No PE signature')
  }
  const optionalHeaderOffset = headerOffset + OPTIONAL_HEADER_OFFSET
  if (view.getUint16(optionalHeaderOffset, true) !== PE32_MAGIC) {
    throw new PortableExecutableError('Not a 32-bit (PE32) image')
  }
  const sectionCount = view.getUint16(headerOffset + SECTION_COUNT_OFFSET, true)
  const sectionTableOffset =
    optionalHeaderOffset + view.getUint16(headerOffset + OPTIONAL_HEADER_SIZE_OFFSET, true)
  if (!getIsInside(executable, sectionTableOffset, sectionCount * SECTION_HEADER_SIZE)) {
    throw new PortableExecutableError('Section table outside the file')
  }
  const sections = Array.from({ length: sectionCount }, (_, sectionIndex) =>
    getSection(executable, view, sectionTableOffset + sectionIndex * SECTION_HEADER_SIZE)
  )
  return Object.freeze({
    imageBase: view.getUint32(optionalHeaderOffset + IMAGE_BASE_OFFSET, true),
    sections: Object.freeze(sections),
  })
}

// The file bytes the loader maps at [virtualAddress, virtualAddress + length).
export const readPortableExecutableBytes = (
  executable: Uint8Array,
  virtualAddress: number,
  length: number
): Uint8Array => {
  const layout = getPortableExecutableLayout(executable)
  const relativeAddress = virtualAddress - layout.imageBase
  const section = layout.sections.find(
    (candidate) =>
      relativeAddress >= candidate.virtualAddress &&
      relativeAddress + length <= candidate.virtualAddress + candidate.rawDataSize
  )
  if (section === undefined) {
    throw new PortableExecutableError(
      `No section holds file data for 0x${virtualAddress.toString(16)} (${String(length)} bytes)`
    )
  }
  const fileOffset = section.rawDataOffset + relativeAddress - section.virtualAddress
  if (!getIsInside(executable, fileOffset, length)) {
    throw new PortableExecutableError('Section data outside the file')
  }
  return executable.slice(fileOffset, fileOffset + length)
}

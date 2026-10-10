import { createHash } from 'node:crypto'
import {
  getIsOriginalExecutablePresent,
  readOriginalExecutable,
} from '../../../../shared/testing/original-files.ts'
import { PortableExecutableError } from '../../types/random-table-errors/random-table-errors.ts'
import { loadRandomTable } from './load-random-table.ts'

// SHA-256 of the 2,048 bytes at 0x004befec in the English LEGORacers.exe (1999-07-22).
const ORIGINAL_TABLE_HASH = 'dc18033635bc1006b0e41d0bb8bed342d554ee0bbf29589d50b35aa000a952d5'

// A minimal PE32 image: image base 0x00400000 and one section mapping RVA 0xbe000 to file offset 0x200.
const createExecutable = (tableValueAt: (index: number) => number): Uint8Array => {
  const headerOffset = 0x40
  const sectionTableOffset = headerOffset + 24 + 0xe0
  const rawDataOffset = 0x200
  const tableOffset = rawDataOffset + 0xfec
  const executable = new Uint8Array(rawDataOffset + 0x1000 + 0x800)
  const view = new DataView(executable.buffer)
  view.setUint32(0x3c, headerOffset, true)
  view.setUint32(headerOffset, 0x00004550, true)
  view.setUint16(headerOffset + 6, 1, true)
  view.setUint16(headerOffset + 20, 0xe0, true)
  view.setUint16(headerOffset + 24, 0x10b, true)
  view.setUint32(headerOffset + 24 + 28, 0x00400000, true)
  executable.set([0x2e, 0x64, 0x61, 0x74, 0x61], sectionTableOffset)
  view.setUint32(sectionTableOffset + 8, 0x1800, true)
  view.setUint32(sectionTableOffset + 12, 0xbe000, true)
  view.setUint32(sectionTableOffset + 16, 0x1800, true)
  view.setUint32(sectionTableOffset + 20, rawDataOffset, true)
  const tableBytes = new Uint8Array(2048)
  const tableView = new DataView(tableBytes.buffer)
  for (let index = 0; index < 1024; index += 1) {
    tableView.setUint16(index * 2, tableValueAt(index), true)
  }
  executable.set(tableBytes, tableOffset)
  return executable
}

describe('loadRandomTable', () => {
  it('reads the 1,024 values at 0x004befec through the section table', () => {
    // Arrange
    const executable = createExecutable((index) => 1023 - index)

    // Act
    const table = loadRandomTable(executable)

    // Assert
    expect(table.values).toHaveLength(1024)
    expect(table.values[0]).toBe(1023)
    expect(table.values[1023]).toBe(0)
  })

  it('refuses a file without a PE signature', () => {
    // Arrange
    const executable = new Uint8Array(0x400)

    // Act
    const load = (): unknown => loadRandomTable(executable)

    // Assert
    expect(load).toThrow(PortableExecutableError)
  })

  it.skipIf(!getIsOriginalExecutablePresent())(
    'reads the original table from the player’s LEGORacers.exe',
    () => {
      // Arrange
      const executable = readOriginalExecutable()

      // Act
      const table = loadRandomTable(executable)

      // Assert
      const bytes = new Uint8Array(new Uint16Array(table.values).buffer)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(ORIGINAL_TABLE_HASH)
      expect(Math.max(...table.values)).toBe(1023)
      expect(Math.min(...table.values)).toBe(0)
    }
  )
})

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TruncatedStringTableError } from '../../types/string-table-errors/string-table-errors.ts'
import { getString } from '../get-string/get-string.ts'
import { parseStringTable } from './parse-string-table.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const toUnsignedShortBytes = (values: readonly number[]): readonly number[] =>
  values.flatMap((value) => [value & 0xff, value >> 8])

describe('parseStringTable', () => {
  it('reads the counts, offsets and 16-bit characters', () => {
    // Arrange
    const bytes = new Uint8Array(toUnsignedShortBytes([2, 6, 0, 3, 0x48, 0x69, 0, 0x263a, 0x41, 0]))

    // Act
    const table = parseStringTable(bytes)

    // Assert
    expect(table).toEqual({
      offsets: [0, 3],
      characters: [0x48, 0x69, 0, 0x263a, 0x41, 0],
      readByteCount: 20,
    })
  })

  it('rejects a file shorter than its counts say', () => {
    // Arrange
    const bytes = new Uint8Array(toUnsignedShortBytes([1, 4, 0, 0x41]))

    // Act
    const parse = () => parseStringTable(bytes)

    // Assert
    expect(parse).toThrow(TruncatedStringTableError)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every string table in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.SRF'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const table = parseStringTable(bytes)
        const strings = table.offsets.map((_, index) => getString(table, index))
        return { path, byteLength: bytes.byteLength, table, strings }
      })

      // Assert
      expect(results).toHaveLength(181)
      for (const { path, byteLength, table, strings } of results) {
        expect({ path, readByteCount: table.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
        expect(strings.every((value) => typeof value === 'string')).toBe(true)
      }
    }
  )
})

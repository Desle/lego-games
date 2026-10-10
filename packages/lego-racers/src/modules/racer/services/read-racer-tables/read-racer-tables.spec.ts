import { PortableExecutableError } from '../../../random-table/index.ts'
import {
  getIsOriginalExecutablePresent,
  readOriginalExecutable,
} from '../../../../shared/testing/original-files.ts'
import { readRacerTables } from './read-racer-tables.ts'

describe('readRacerTables', () => {
  it('rejects bytes that are not a PE image', () => {
    // Arrange
    const executable = new Uint8Array(64)

    // Act
    const read = () => readRacerTables(executable)

    // Assert
    expect(read).toThrow(PortableExecutableError)
  })

  it.skipIf(!getIsOriginalExecutablePresent())(
    'reads the original tables: random values 0–1023 and a cosine over one turn',
    () => {
      // Arrange
      const executable = readOriginalExecutable()

      // Act
      const tables = readRacerTables(executable)

      // Assert
      expect(tables.randomTable.values.slice(0, 4)).toEqual([598, 512, 817, 129])
      expect(tables.cosineValues[0]).toBe(1)
      expect(tables.cosineValues[1]).toBe(Math.fround(0.999981164932251))
      expect(tables.cosineValues[256]).toBe(0)
      expect(tables.cosineValues[512]).toBe(-1)
    }
  )
})

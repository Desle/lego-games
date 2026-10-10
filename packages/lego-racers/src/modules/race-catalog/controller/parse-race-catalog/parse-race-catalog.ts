import { getUnsignedShort } from '../../../../shared/binary-values/binary-values.ts'
import type { CircuitDatabase } from '../../../circuit-database/index.ts'
import {
  findNamedRecord,
  readKeywordBlock,
  readNamedRecords,
  RECORD_NAME_MAXIMUM_LENGTH,
} from '../../../named-record/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { RaceCatalogKeyword } from '../../types/race-catalog-keyword/race-catalog-keyword.ts'
import { UnknownCircuitError } from '../../types/race-catalog-errors/race-catalog-errors.ts'
import type { RaceCatalog, RaceCatalogEntry } from '../../types/race-catalog.types.ts'

const createEmptyEntry = (name: string): RaceCatalogEntry =>
  Object.freeze({
    name,
    raceNumber: 0,
    firstName: '',
    circuitName: '',
    shortNumber: 0,
    isFlagged: false,
    secondName: '',
    thirdName: '',
  })

const readName = (reader: TokenReader) =>
  reader.readStringWithMaximumLength(RECORD_NAME_MAXIMUM_LENGTH)

const applyKeyword = (
  reader: TokenReader,
  keyword: number,
  entry: RaceCatalogEntry,
  circuits: CircuitDatabase
): RaceCatalogEntry | null => {
  switch (keyword) {
    case RaceCatalogKeyword.RACE_NUMBER:
      return Object.freeze({ ...entry, raceNumber: reader.readInteger() })
    case RaceCatalogKeyword.FIRST_NAME:
      return Object.freeze({ ...entry, firstName: readName(reader) })
    case RaceCatalogKeyword.CIRCUIT: {
      const circuitName = readName(reader)
      if (findNamedRecord(circuits.circuits, circuitName) === null) {
        throw new UnknownCircuitError(circuitName)
      }
      return Object.freeze({ ...entry, circuitName })
    }
    case RaceCatalogKeyword.SHORT_NUMBER:
      return Object.freeze({ ...entry, shortNumber: getUnsignedShort(reader.readInteger()) })
    case RaceCatalogKeyword.FLAG:
      return Object.freeze({ ...entry, isFlagged: true })
    case RaceCatalogKeyword.SECOND_NAME:
      return Object.freeze({ ...entry, secondName: readName(reader) })
    case RaceCatalogKeyword.THIRD_NAME:
      return Object.freeze({ ...entry, thirdName: readName(reader) })
    default:
      return null
  }
}

// LEGORacers.exe 0x004366f0: `0x27 [ count ] { (0x27 name { keywords }) * count }`; the circuits come from
// LEGORACE.CRB (Circuits_Load), which the front end loads first.
export const parseRaceCatalog = (bytes: Uint8Array, circuits: CircuitDatabase): RaceCatalog => {
  const { records, readByteCount } = readNamedRecords(bytes, (reader, name) =>
    readKeywordBlock(reader, createEmptyEntry(name), (keyword, entry) =>
      applyKeyword(reader, keyword, entry, circuits)
    )
  )
  return Object.freeze({ entries: records, readByteCount })
}

import { getUnsignedShort } from '../../../../shared/binary-values/binary-values.ts'
import { UnportableFileError } from '../../../../shared/errors/gol-file-errors.ts'
import {
  readKeywordBlock,
  readNamedRecords,
  RECORD_NAME_MAXIMUM_LENGTH,
} from '../../../named-record/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import {
  CIRCUIT_RACER_CODE_CAPACITY,
  CircuitKeyword,
} from '../../types/circuit-keyword/circuit-keyword.ts'
import type { Circuit, CircuitDatabase } from '../../types/circuit-database.types.ts'

const createEmptyCircuit = (name: string): Circuit =>
  Object.freeze({
    name,
    racerCodes: Object.freeze([]),
    firstNumber: 0,
    secondNumber: 0,
    nextName: '',
  })

const readRacerCodes = (reader: TokenReader): readonly string[] => {
  const count = reader.readArrayCount()
  if (count > CIRCUIT_RACER_CODE_CAPACITY) {
    throw new UnportableFileError(
      'More racer codes than the circuit record holds',
      reader.getPosition()
    )
  }
  const codes = Array.from({ length: count }, () =>
    reader.readStringWithMaximumLength(RECORD_NAME_MAXIMUM_LENGTH)
  )
  reader.expectRightCurly()
  return Object.freeze(codes)
}

const applyKeyword = (reader: TokenReader, keyword: number, circuit: Circuit): Circuit | null => {
  switch (keyword) {
    case CircuitKeyword.RACER_CODES:
      return Object.freeze({ ...circuit, racerCodes: readRacerCodes(reader) })
    case CircuitKeyword.FIRST_NUMBER:
      return Object.freeze({ ...circuit, firstNumber: getUnsignedShort(reader.readInteger()) })
    case CircuitKeyword.SECOND_NUMBER:
      return Object.freeze({ ...circuit, secondNumber: reader.readInteger() })
    case CircuitKeyword.NEXT_NAME:
      return Object.freeze({ ...circuit, nextName: reader.readString().slice(0, 8) })
    default:
      return null
  }
}

// LEGORacers.exe 0x0041f1d0: `0x27 [ count ] { (0x27 name { keywords }) * count }`.
export const parseCircuitDatabase = (bytes: Uint8Array): CircuitDatabase => {
  const { records, readByteCount } = readNamedRecords(bytes, (reader, name) =>
    readKeywordBlock(reader, createEmptyCircuit(name), (keyword, circuit) =>
      applyKeyword(reader, keyword, circuit)
    )
  )
  return Object.freeze({ circuits: records, readByteCount })
}

import { createNameTable } from '../../../../shared/name-table/name-table.ts'
import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import type { NamedRecordList } from '../../types/named-record.types.ts'

export const NAMED_RECORD_KEYWORD = 0x27
export const RECORD_NAME_MAXIMUM_LENGTH = 8

// The keyword loop every record loader runs after its `{`: `while (token != 6) switch (token) … default: error 0`.
// applyKeyword returns the new state, or null for a keyword the record does not know.
export const readKeywordBlock = <State>(
  reader: TokenReader,
  initial: State,
  applyKeyword: (keyword: number, state: State) => State | null
): State => {
  let state = initial
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    state = applyKeyword(keyword, state) ?? reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
  return state
}

// 0x004119a0: a lookup compares the first eight characters of the name.
export const findNamedRecord = <Record extends { readonly name: string }>(
  records: readonly Record[],
  name: string
): Record | null =>
  records.find(
    (record) => record.name.slice(0, RECORD_NAME_MAXIMUM_LENGTH) === name.slice(0, RECORD_NAME_MAXIMUM_LENGTH)
  ) ?? null

// Drivers_Load 0x004208f0, Champions_Load 0x0041d370, Chassis_Load 0x0041db10, Circuits_Load 0x0041f1d0 and
// RaceCatalog_Load 0x004366f0: the count, then per record the name (at most eight characters) and its block, which
// readRecord reads up to and including the closing curly. Every loader registers the name in a table that is fatal
// on a duplicate (0x00411870); a record is registered after its block is read.
export const readNamedRecords = <Record>(
  bytes: Uint8Array,
  readRecord: (reader: TokenReader, name: string) => Record
): NamedRecordList<Record> => {
  const reader = createTokenReader(bytes)
  reader.expectToken(NAMED_RECORD_KEYWORD)
  const names = createNameTable()
  const records: Record[] = []
  for (let remaining = reader.readArrayCount(); remaining !== 0; remaining -= 1) {
    reader.expectToken(NAMED_RECORD_KEYWORD)
    const name = reader.readStringWithMaximumLength(RECORD_NAME_MAXIMUM_LENGTH)
    reader.expectLeftCurly()
    records.push(readRecord(reader, name))
    names.add(name, records.length - 1)
  }
  reader.expectRightCurly()
  return Object.freeze({ records: Object.freeze(records), readByteCount: reader.getPosition() })
}

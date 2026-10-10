import { DuplicateNameError } from '../../../../shared/errors/gol-file-errors.ts'
import { LEFT_CURLY, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import {
  findNamedRecord,
  NAMED_RECORD_KEYWORD,
  readKeywordBlock,
  readNamedRecords,
} from './read-named-records.ts'

const VALUE_KEYWORD = 0x28

const getFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([
    NAMED_RECORD_KEYWORD,
    ...encodeArrayHeader(blocks.length),
    ...blocks.flat(),
    RIGHT_CURLY,
  ])

const getBlock = (name: string, body: readonly number[]): readonly number[] => [
  NAMED_RECORD_KEYWORD,
  ...encodeString(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

type Entry = { readonly name: string; readonly value: number }

const readEntry = (bytes: Uint8Array) =>
  readNamedRecords<Entry>(bytes, (reader, name) =>
    readKeywordBlock<Entry>(reader, { name, value: 0 }, (keyword, entry) =>
      keyword === VALUE_KEYWORD ? { ...entry, value: reader.readInteger() } : null
    )
  )

describe('readNamedRecords', () => {
  it('reads each block under its name and reports the bytes consumed', () => {
    // Arrange
    const bytes = getFile([
      getBlock('first', [VALUE_KEYWORD, ...encodeInteger(7)]),
      getBlock('second', []),
    ])

    // Act
    const list = readEntry(bytes)

    // Assert
    expect(list.records).toEqual([
      { name: 'first', value: 7 },
      { name: 'second', value: 0 },
    ])
    expect(list.readByteCount).toBe(bytes.byteLength)
  })

  it('stops with a syntax error at a keyword the record does not know', () => {
    // Arrange
    const bytes = getFile([getBlock('first', [0x30, ...encodeInteger(1)])])

    // Act
    const read = () => readEntry(bytes)

    // Assert
    expect(read).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it('refuses a name longer than eight characters', () => {
    // Arrange
    const bytes = getFile([getBlock('nineChars', [])])

    // Act
    const read = () => readEntry(bytes)

    // Assert
    expect(read).toThrow(expect.objectContaining({ failure: TokenReaderFailure.INVALID_STRING }))
  })

  it('stops at a name that appears twice, as the exe does (0x00411870)', () => {
    // Arrange
    const bytes = getFile([getBlock('same', []), getBlock('same', [])])

    // Act
    const read = () => readEntry(bytes)

    // Assert
    expect(read).toThrow(DuplicateNameError)
  })
})

describe('findNamedRecord', () => {
  it('compares the first eight characters of the names (0x004119a0)', () => {
    // Arrange
    const records = [{ name: 'dachas01' }, { name: 'other' }]

    // Act
    const found = findNamedRecord(records, 'dachas012345')

    // Assert
    expect(found).toBe(records[0])
  })

  it('answers null for a name the table does not hold', () => {
    // Arrange
    const records = [{ name: 'dachas0' }]

    // Act
    const found = findNamedRecord(records, 'missing')

    // Assert
    expect(found).toBeNull()
  })
})

import { UnportableFileError } from '../../../../shared/errors/gol-file-errors.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { LEFT_CURLY, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { CircuitKeyword } from '../../types/circuit-keyword/circuit-keyword.ts'
import { parseCircuitDatabase } from './parse-circuit-database.ts'

const getFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([
    CircuitKeyword.CIRCUITS,
    ...encodeArrayHeader(blocks.length),
    ...blocks.flat(),
    RIGHT_CURLY,
  ])

const getBlock = (name: string, body: readonly number[]): readonly number[] => [
  CircuitKeyword.CIRCUITS,
  ...encodeString(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

const getRacerCodes = (codes: readonly string[]): readonly number[] => [
  CircuitKeyword.RACER_CODES,
  ...encodeArrayHeader(codes.length),
  ...codes.flatMap((code) => encodeString(code)),
  RIGHT_CURLY,
]

describe('parseCircuitDatabase', () => {
  it('reads the racer codes, the two numbers and the next circuit', () => {
    // Arrange
    const bytes = getFile([
      getBlock('c1', [
        ...getRacerCodes(['KK', 'IL']),
        CircuitKeyword.FIRST_NUMBER,
        ...encodeInteger(0x10003),
        CircuitKeyword.SECOND_NUMBER,
        ...encodeInteger(4),
        CircuitKeyword.NEXT_NAME,
        ...encodeString('c2'),
      ]),
    ])

    // Act
    const database = parseCircuitDatabase(bytes)

    // Assert
    expect(database.circuits).toEqual([
      { name: 'c1', racerCodes: ['KK', 'IL'], firstNumber: 3, secondNumber: 4, nextName: 'c2' },
    ])
    expect(database.readByteCount).toBe(bytes.byteLength)
  })

  it('refuses more racer codes than the 100-byte record holds before it overwrites its numbers', () => {
    // Arrange
    const codes = Array.from({ length: 9 }, () => 'KK')
    const bytes = getFile([getBlock('c1', getRacerCodes(codes))])

    // Act
    const parse = () => parseCircuitDatabase(bytes)

    // Assert
    expect(parse).toThrow(UnportableFileError)
  })

  it('stops with a syntax error at a keyword it does not know', () => {
    // Arrange
    const bytes = getFile([getBlock('c1', [0x2c, ...encodeInteger(1)])])

    // Act
    const parse = () => parseCircuitDatabase(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())('parses the original LEGORACE.CRB to its last byte', () => {
    // Arrange
    const archive = openJamArchive(readOriginalJam())
    const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.CRB'))
    const [path] = paths
    const bytes = archive.readFile(path ?? '')

    // Act
    const database = parseCircuitDatabase(bytes)

    // Assert
    expect(paths).toHaveLength(1)
    expect(database.readByteCount).toBe(bytes.byteLength)
    expect(database.circuits.map(({ name }) => name)).toEqual([
      'c0',
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
    ])
    expect(database.circuits[1]).toEqual({
      name: 'c1',
      racerCodes: ['KK', 'KK', 'IL', 'RK', 'CC', 'TC'],
      firstNumber: 1,
      secondNumber: 1,
      nextName: 'c2',
    })
  })
})

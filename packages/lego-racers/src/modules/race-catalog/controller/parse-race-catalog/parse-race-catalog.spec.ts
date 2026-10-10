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
import { parseCircuitDatabase } from '../../../circuit-database/index.ts'
import type { CircuitDatabase } from '../../../circuit-database/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { UnknownCircuitError } from '../../types/race-catalog-errors/race-catalog-errors.ts'
import { RaceCatalogKeyword } from '../../types/race-catalog-keyword/race-catalog-keyword.ts'
import { parseRaceCatalog } from './parse-race-catalog.ts'

const CIRCUITS: CircuitDatabase = {
  circuits: [{ name: 'c1', racerCodes: [], firstNumber: 0, secondNumber: 0, nextName: '' }],
  readByteCount: 0,
}

const getFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([
    RaceCatalogKeyword.RACES,
    ...encodeArrayHeader(blocks.length),
    ...blocks.flat(),
    RIGHT_CURLY,
  ])

const getBlock = (name: string, body: readonly number[]): readonly number[] => [
  RaceCatalogKeyword.RACES,
  ...encodeString(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

describe('parseRaceCatalog', () => {
  it('reads the number, the folder, the circuit and the names of a race', () => {
    // Arrange
    const bytes = getFile([
      getBlock('rkr', [
        RaceCatalogKeyword.RACE_NUMBER,
        ...encodeInteger(1),
        RaceCatalogKeyword.FIRST_NAME,
        ...encodeString('racec0r0'),
        RaceCatalogKeyword.CIRCUIT,
        ...encodeString('c1'),
        RaceCatalogKeyword.SHORT_NUMBER,
        ...encodeInteger(4),
        RaceCatalogKeyword.FLAG,
        RaceCatalogKeyword.SECOND_NAME,
        ...encodeString('castle1'),
        RaceCatalogKeyword.THIRD_NAME,
        ...encodeString('RK'),
      ]),
    ])

    // Act
    const catalog = parseRaceCatalog(bytes, CIRCUITS)

    // Assert
    expect(catalog.entries).toEqual([
      {
        name: 'rkr',
        raceNumber: 1,
        firstName: 'racec0r0',
        circuitName: 'c1',
        shortNumber: 4,
        isFlagged: true,
        secondName: 'castle1',
        thirdName: 'RK',
      },
    ])
    expect(catalog.readByteCount).toBe(bytes.byteLength)
  })

  it('stops at a circuit that LEGORACE.CRB does not hold (0x004bef1c)', () => {
    // Arrange
    const bytes = getFile([getBlock('rkr', [RaceCatalogKeyword.CIRCUIT, ...encodeString('c9')])])

    // Act
    const parse = () => parseRaceCatalog(bytes, CIRCUITS)

    // Assert
    expect(parse).toThrow(UnknownCircuitError)
  })

  it('stops with a syntax error at a keyword it does not know', () => {
    // Arrange
    const bytes = getFile([getBlock('rkr', [0x2f, ...encodeInteger(1)])])

    // Act
    const parse = () => parseRaceCatalog(bytes, CIRCUITS)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses the original LEGORACE.RCB to its last byte against LEGORACE.CRB',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const circuits = parseCircuitDatabase(archive.readFile('MENUDATA\\LEGORACE.CRB'))
      const bytes = archive.readFile('MENUDATA\\LEGORACE.RCB')

      // Act
      const catalog = parseRaceCatalog(bytes, circuits)

      // Assert
      expect(catalog.readByteCount).toBe(bytes.byteLength)
      expect(catalog.entries).toHaveLength(27)
      expect(catalog.entries.find(({ firstName }) => firstName === 'racec0r0')).toEqual({
        name: 'rkr',
        raceNumber: 1,
        firstName: 'racec0r0',
        circuitName: 'c1',
        shortNumber: 4,
        isFlagged: false,
        secondName: 'castle1',
        thirdName: 'RK',
      })
    }
  )
})

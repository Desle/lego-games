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
import { findNamedRecord } from '../../../named-record/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { DriverKeyword } from '../../types/driver-keyword/driver-keyword.ts'
import { parseDriverDatabase } from './parse-driver-database.ts'

const getFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([
    DriverKeyword.DRIVERS,
    ...encodeArrayHeader(blocks.length),
    ...blocks.flat(),
    RIGHT_CURLY,
  ])

const getBlock = (name: string, body: readonly number[]): readonly number[] => [
  DriverKeyword.DRIVERS,
  ...encodeString(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

const FULL_BLOCK_BODY = [
  DriverKeyword.MATERIAL_LIBRARY,
  ...encodeString('mat'),
  DriverKeyword.TEXTURE_DATABASE,
  ...encodeString('tex'),
  DriverKeyword.MODEL,
  ...encodeString('mod'),
  DriverKeyword.CHAMPION,
  ...encodeString('champ'),
  DriverKeyword.PERSONALITY_FIRST,
  ...encodeInteger(10),
  DriverKeyword.PERSONALITY_SECOND,
  ...encodeInteger(20),
  DriverKeyword.PERSONALITY_THIRD,
  ...encodeInteger(30),
  DriverKeyword.PERSONALITY_FOURTH,
  ...encodeInteger(40),
  DriverKeyword.PERSONALITY_FIFTH,
  ...encodeInteger(50),
  DriverKeyword.PERSONALITY_SIXTH,
  ...encodeInteger(60),
  DriverKeyword.NAME_STRING_IDENTIFIER,
  ...encodeInteger(0x10005),
  DriverKeyword.VOICE_NUMBER,
  ...encodeInteger(3),
  DriverKeyword.UNREAD_FIRST,
  ...encodeInteger(1),
  DriverKeyword.UNREAD_FIFTH,
  ...encodeInteger(5),
  DriverKeyword.PREFERRED_POWER_UP,
  ...encodeInteger(2),
  ...encodeInteger(3),
]

describe('parseDriverDatabase', () => {
  it('reads every field of a driver block', () => {
    // Arrange
    const bytes = getFile([getBlock('AB', FULL_BLOCK_BODY)])

    // Act
    const database = parseDriverDatabase(bytes)

    // Assert
    expect(database.drivers).toEqual([
      {
        name: 'AB',
        nameStringIdentifier: 5,
        materialLibraryName: 'mat',
        textureDatabaseName: 'tex',
        modelName: 'mod',
        championName: 'champ',
        preferredPowerUpCode: 2,
        preferredPowerUpLevel: 3,
        personalityBytes: [10, 20, 30, 40, 50, 60],
        voiceNumber: 3,
        unreadBytes: [1, 0, 0, 0, 5],
      },
    ])
    expect(database.readByteCount).toBe(bytes.byteLength)
  })

  it('leaves a field the block omits at zero or empty, as the zeroed record does', () => {
    // Arrange
    const bytes = getFile([getBlock('AB', [])])

    // Act
    const [driver] = parseDriverDatabase(bytes).drivers

    // Assert
    expect(driver).toEqual({
      name: 'AB',
      nameStringIdentifier: 0,
      materialLibraryName: '',
      textureDatabaseName: '',
      modelName: '',
      championName: '',
      preferredPowerUpCode: 0,
      preferredPowerUpLevel: 0,
      personalityBytes: [0, 0, 0, 0, 0, 0],
      voiceNumber: 0,
      unreadBytes: [0, 0, 0, 0, 0],
    })
  })

  it('keeps an integer as the byte the exe stores', () => {
    // Arrange
    const bytes = getFile([
      getBlock('AB', [DriverKeyword.PERSONALITY_FIRST, ...encodeInteger(0x1ff)]),
    ])

    // Act
    const [driver] = parseDriverDatabase(bytes).drivers

    // Assert
    expect(driver?.personalityBytes[0]).toBe(0xff)
  })

  it('stops with a syntax error at a keyword it does not know', () => {
    // Arrange
    const bytes = getFile([getBlock('AB', [0x32, ...encodeInteger(1)])])

    // Act
    const parse = () => parseDriverDatabase(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every driver database in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.DDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseDriverDatabase(bytes) }
      })

      // Assert
      expect(results).toHaveLength(2)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
      const race = results.find(({ path }) => path.includes('GAMEDATA'))
      const king = findNamedRecord(race?.parsed.drivers ?? [], 'KK')
      expect(race?.parsed.drivers).toHaveLength(24)
      expect(king).toMatchObject({
        championName: 'kk',
        personalityBytes: [10, 100, 80, 20, 60, 70],
        preferredPowerUpCode: 2,
        voiceNumber: 6,
      })
    }
  )
})

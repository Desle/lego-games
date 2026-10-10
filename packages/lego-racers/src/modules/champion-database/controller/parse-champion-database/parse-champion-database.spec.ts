import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { floatTokens, LEFT_CURLY, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { findNamedRecord } from '../../../named-record/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { ChampionKeyword } from '../../types/champion-keyword/champion-keyword.ts'
import { parseChampionDatabase } from './parse-champion-database.ts'

const getFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([
    ChampionKeyword.CHAMPIONS,
    ...encodeArrayHeader(blocks.length),
    ...blocks.flat(),
    RIGHT_CURLY,
  ])

const getBlock = (name: string, body: readonly number[]): readonly number[] => [
  ChampionKeyword.CHAMPIONS,
  ...encodeString(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

describe('parseChampionDatabase', () => {
  it('reads the names, the mass and the centre of mass of a champion', () => {
    // Arrange
    const bytes = getFile([
      getBlock('kk', [
        ChampionKeyword.MATERIAL_LIBRARY,
        ...encodeString('kkmat'),
        ChampionKeyword.TEXTURE_DATABASE,
        ...encodeString('kktex'),
        ChampionKeyword.MODEL,
        ...encodeString('kkmod'),
        ChampionKeyword.CHASSIS,
        ...encodeString('kkchas0'),
        ChampionKeyword.MASS,
        ...floatTokens([4500]),
        ChampionKeyword.CENTRE_OF_MASS,
        ...floatTokens([-1, 0.5, -2]),
      ]),
    ])

    // Act
    const database = parseChampionDatabase(bytes)

    // Assert
    expect(database.champions).toEqual([
      {
        name: 'kk',
        materialLibraryName: 'kkmat',
        textureDatabaseName: 'kktex',
        modelName: 'kkmod',
        chassisName: 'kkchas0',
        mass: 4500,
        centreOfMass: [-1, 0.5, -2],
      },
    ])
    expect(database.readByteCount).toBe(bytes.byteLength)
  })

  it('does not mirror the centre of mass', () => {
    // Arrange
    const bytes = getFile([
      getBlock('kk', [ChampionKeyword.CENTRE_OF_MASS, ...floatTokens([1, 2, 3])]),
    ])

    // Act
    const [champion] = parseChampionDatabase(bytes).champions

    // Assert
    expect(champion?.centreOfMass).toEqual([1, 2, 3])
  })

  it('stops with a syntax error at a keyword it does not know', () => {
    // Arrange
    const bytes = getFile([getBlock('kk', [0x2e, ...encodeInteger(1)])])

    // Act
    const parse = () => parseChampionDatabase(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every champion database in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.CCB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseChampionDatabase(bytes) }
      })

      // Assert
      expect(results).toHaveLength(2)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
        expect(parsed.champions).toHaveLength(20)
        expect(findNamedRecord(parsed.champions, 'kk')).toEqual({
          name: 'kk',
          materialLibraryName: 'kkcm',
          textureDatabaseName: 'kkcm',
          modelName: 'kkcm',
          chassisName: 'kkchas0',
          mass: 4500,
          centreOfMass: [-1, 0, -1],
        })
      }
    }
  )
})

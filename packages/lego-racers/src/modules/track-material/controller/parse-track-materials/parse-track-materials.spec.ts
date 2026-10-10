import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import {
  arrayHeaderTokens,
  floatToken,
  floatTokens,
  integerToken,
  LEFT_CURLY,
  RIGHT_CURLY,
  stringToken,
} from '../../../../shared/testing/token-bytes.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { parseTrackMaterials } from './parse-track-materials.ts'

const materialFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...arrayHeaderTokens(blocks.length), ...blocks.flat(), RIGHT_CURLY])

const materialBlock = (name: string, body: readonly number[]): readonly number[] => [
  0x27,
  ...stringToken(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

describe('parseTrackMaterials', () => {
  it('stores each value and sets its flag bit plus the loaded bit', () => {
    // Arrange
    const bytes = materialFile([
      materialBlock('grass', [
        0x2e,
        ...integerToken(3006),
        0x36,
        ...floatToken(20),
        0x31,
        ...stringToken('grassemt'),
        0x2c,
        ...floatTokens([1, 2, 3]),
        0x37,
      ]),
      materialBlock('go_thru', []),
    ])

    // Act
    const parsed = parseTrackMaterials(bytes, false)

    // Assert
    expect(parsed.trackMaterials[0]).toMatchObject({
      name: 'grass',
      flags: 0x1 | 0x80 | 0x8000 | 0x400 | 0x20 | 0x10000,
      fifthInteger: 3006,
      fifthFloat: 20,
      linkedName: 'grassemt',
      firstVector: [1, 2, 3],
    })
    expect(parsed.trackMaterials[1]).toMatchObject({
      name: 'go_thru',
      flags: 0x1,
      linkedName: null,
    })
    expect(parsed.readByteCount).toBe(bytes.byteLength)
  })

  it('negates the y of both vectors on a mirrored track', () => {
    // Arrange
    const bytes = materialFile([
      materialBlock('road', [0x2c, ...floatTokens([1, 2, 3]), 0x2d, ...floatTokens([4, 5, 6])]),
    ])

    // Act
    const [material] = parseTrackMaterials(bytes, true).trackMaterials

    // Assert
    expect([material?.firstVector, material?.secondVector]).toEqual([
      [1, -2, 3],
      [4, -5, 6],
    ])
  })

  it('rejects an unknown keyword as a syntax error', () => {
    // Arrange
    const bytes = materialFile([materialBlock('bad', [0x3a])])

    // Act
    const parse = () => parseTrackMaterials(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every track material file in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.TMB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseTrackMaterials(bytes, false) }
      })

      // Assert
      expect(results).toHaveLength(14)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})

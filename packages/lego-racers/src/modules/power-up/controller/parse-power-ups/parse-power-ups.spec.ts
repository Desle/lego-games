import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import {
  arrayHeaderTokens,
  floatTokens,
  integerToken,
  LEFT_CURLY,
  RIGHT_CURLY,
  stringToken,
} from '../../../../shared/testing/token-bytes.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { parsePowerUps } from './parse-power-ups.ts'

const list = (keyword: number, blocks: readonly (readonly number[])[]): readonly number[] => [
  keyword,
  ...arrayHeaderTokens(blocks.length),
  ...blocks.flat(),
  RIGHT_CURLY,
]

const block = (keyword: number, body: readonly number[]): readonly number[] => [
  keyword,
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

describe('parsePowerUps', () => {
  it('reads both lists with each brick kind, identifier and ignored values', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...list(0x27, [
        block(0x27, [0x28, ...floatTokens([1, 2, 3]), 0x2a]),
        block(0x27, [
          0x2b,
          0x2e,
          ...integerToken(5),
          0x30,
          ...stringToken('name'),
          ...integerToken(9),
        ]),
        block(0x27, [0x2c, 0x31, ...integerToken(4)]),
        block(0x27, []),
      ]),
      0x50,
      ...list(0x2f, [block(0x2f, [0x28, ...floatTokens([4, 5, 6])])]),
    ])

    // Act
    const parsed = parsePowerUps(bytes, false)

    // Assert
    expect(parsed).toEqual({
      bricks: [
        { position: [1, 2, 3], kind: 1, identifier: -1 },
        { position: [0, 0, 0], kind: 4, identifier: 5 },
        { position: [0, 0, 0], kind: 2, identifier: -1 },
        { position: [0, 0, 0], kind: 3, identifier: -1 },
      ],
      enhancementBricks: [{ position: [4, 5, 6] }],
      readByteCount: bytes.byteLength,
    })
  })

  it('negates the y of every position on a mirrored track', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...list(0x27, [block(0x27, [0x28, ...floatTokens([1, 2, 3])])]),
      ...list(0x2f, [block(0x2f, [0x28, ...floatTokens([4, 5, 6])])]),
    ])

    // Act
    const parsed = parsePowerUps(bytes, true)

    // Assert
    expect([parsed.bricks[0]?.position, parsed.enhancementBricks[0]?.position]).toEqual([
      [1, -2, 3],
      [4, -5, 6],
    ])
  })

  it('rejects a kind keyword inside an enhancement brick as a syntax error', () => {
    // Arrange
    const bytes = new Uint8Array(list(0x2f, [block(0x2f, [0x2a])]))

    // Act
    const parse = () => parsePowerUps(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every power-up file in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.PWB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parsePowerUps(bytes, false) }
      })

      // Assert
      expect(results).toHaveLength(26)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
      const royalKnights = results.find(({ path }) => path.endsWith('RACEC0R0\\POWERUP.PWB'))
      expect([
        royalKnights?.parsed.bricks.length,
        royalKnights?.parsed.enhancementBricks.length,
      ]).toEqual([27, 12])
    }
  )
})

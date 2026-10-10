import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { floatTokens, LEFT_CURLY, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeInteger,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { parseStartPositions } from './parse-start-positions.ts'

const startPositionFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...encodeArrayHeader(blocks.length), ...blocks.flat(), RIGHT_CURLY])

const FULL_BLOCK = [
  0x27,
  ...encodeInteger(2),
  LEFT_CURLY,
  0x28,
  ...floatTokens([379.5, 210.5, 0.25]),
  0x29,
  ...floatTokens([0, 1, 0, 0, 0, 1]),
  RIGHT_CURLY,
]

describe('parseStartPositions', () => {
  it('reads each slot with its position and axes', () => {
    // Arrange
    const bytes = startPositionFile([
      FULL_BLOCK,
      [0x27, ...encodeInteger(4), LEFT_CURLY, RIGHT_CURLY],
    ])

    // Act
    const parsed = parseStartPositions(bytes, false)

    // Assert
    expect(parsed).toEqual({
      startPositions: [
        { slot: 2, position: [379.5, 210.5, 0.25], firstAxis: [0, 1, 0], secondAxis: [0, 0, 1] },
        { slot: 4, position: null, firstAxis: null, secondAxis: null },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('negates every y on a mirrored track', () => {
    // Arrange
    const bytes = startPositionFile([FULL_BLOCK])

    // Act
    const [startPosition] = parseStartPositions(bytes, true).startPositions

    // Assert
    expect(startPosition).toEqual({
      slot: 2,
      position: [379.5, -210.5, 0.25],
      firstAxis: [0, -1, 0],
      secondAxis: [0, -0, 1],
    })
  })

  it('rejects an unknown keyword inside a block as a syntax error', () => {
    // Arrange
    const bytes = startPositionFile([[0x27, ...encodeInteger(0), LEFT_CURLY, 0x2a, RIGHT_CURLY]])

    // Act
    const parse = () => parseStartPositions(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every start position file in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.SPB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseStartPositions(bytes, false) }
      })

      // Assert
      expect(results).toHaveLength(14)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
      const royalKnights = results.find(({ path }) => path.includes('RACEC0R0'))
      expect(royalKnights?.parsed.startPositions.map(({ slot }) => slot)).toEqual([
        2, 1, 3, 5, 0, 4,
      ])
    }
  )
})

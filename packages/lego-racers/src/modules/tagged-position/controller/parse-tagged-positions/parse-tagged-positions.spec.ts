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
import { parseTaggedPositions } from './parse-tagged-positions.ts'

const taggedPositionFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...encodeArrayHeader(blocks.length), ...blocks.flat(), RIGHT_CURLY])

const BLOCK = [
  0x27,
  LEFT_CURLY,
  0x28,
  ...floatTokens([-407.5, 514.25, 65.5]),
  0x29,
  ...encodeInteger(7),
  RIGHT_CURLY,
]

describe('parseTaggedPositions', () => {
  it('reads each position and identifier, defaulting the identifier to -1', () => {
    // Arrange
    const bytes = taggedPositionFile([BLOCK, [0x27, LEFT_CURLY, RIGHT_CURLY]])

    // Act
    const parsed = parseTaggedPositions(bytes, false)

    // Assert
    expect(parsed).toEqual({
      taggedPositions: [
        { position: [-407.5, 514.25, 65.5], identifier: 7 },
        { position: [0, 0, 0], identifier: -1 },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('negates the y of a mirrored position', () => {
    // Arrange
    const bytes = taggedPositionFile([BLOCK])

    // Act
    const [taggedPosition] = parseTaggedPositions(bytes, true).taggedPositions

    // Assert
    expect(taggedPosition?.position).toEqual([-407.5, -514.25, 65.5])
  })

  it('stops after the count when the count is zero', () => {
    // Arrange
    const bytes = taggedPositionFile([])

    // Act
    const parsed = parseTaggedPositions(bytes, false)

    // Assert
    expect(parsed.readByteCount).toBe(bytes.byteLength - 1)
  })

  it('rejects an unknown keyword inside a block as a syntax error', () => {
    // Arrange
    const bytes = taggedPositionFile([[0x27, LEFT_CURLY, 0x2a, RIGHT_CURLY]])

    // Act
    const parse = () => parseTaggedPositions(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every tagged position file in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.TGB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseTaggedPositions(bytes, false) }
      })

      // Assert
      expect(results).toHaveLength(5)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})

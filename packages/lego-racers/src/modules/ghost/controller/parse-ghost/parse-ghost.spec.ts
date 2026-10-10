import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import {
  floatTokens,
  integerTokens,
  LEFT_CURLY,
  RIGHT_CURLY,
} from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeInteger,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { TooManyGhostSamplesError } from '../../types/ghost-errors/ghost-errors.ts'
import { parseGhost } from './parse-ghost.ts'

const ghostFile = (body: readonly number[]): Uint8Array =>
  new Uint8Array([0x2c, LEFT_CURLY, ...body, RIGHT_CURLY])

const BODY = [
  0x2a,
  ...integerTokens([32266, 30015, 33066]),
  0x28,
  ...floatTokens([356.5, 211.25, 0.375]),
  0x29,
  ...floatTokens([0, 0.5, 0, 0.5]),
  0x2b,
  ...encodeInteger(7),
  0x27,
  ...encodeArrayHeader(1),
  ...integerTokens([11423, 6762, 0x18000, 251, 5, 167, 90]),
  RIGHT_CURLY,
]

describe('parseGhost', () => {
  it('reads the integers, start state and samples', () => {
    // Arrange
    const bytes = ghostFile(BODY)

    // Act
    const parsed = parseGhost(bytes, false)

    // Assert
    expect(parsed).toEqual({
      firstIntegers: [32266, 30015, 33066],
      secondInteger: 7,
      startPosition: [356.5, 211.25, 0.375],
      startQuaternion: [0, 0.5, 0, 0.5],
      samples: [{ position: [11423, 6762, -0x8000], orientationBytes: [251, 5, 167, 90] }],
      readByteCount: bytes.byteLength,
    })
  })

  it('negates the y components and orientation bytes 1 and 3 when mirrored', () => {
    // Arrange
    const bytes = ghostFile(BODY)

    // Act
    const parsed = parseGhost(bytes, true)

    // Assert
    expect(parsed).toMatchObject({
      startPosition: [356.5, -211.25, 0.375],
      startQuaternion: [0, -0.5, 0, -0.5],
      samples: [{ position: [11423, -6762, -0x8000], orientationBytes: [251, 0xfb, 167, 0xa6] }],
    })
  })

  it('refuses more samples than the original buffer holds', () => {
    // Arrange
    const bytes = ghostFile([0x27, ...encodeArrayHeader(0x3c2)])

    // Act
    const parse = () => parseGhost(bytes, false)

    // Assert
    expect(parse).toThrow(TooManyGhostSamplesError)
  })

  it('rejects an unknown keyword as a syntax error', () => {
    // Arrange
    const bytes = ghostFile([0x2d])

    // Act
    const parse = () => parseGhost(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every ghost in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.GHB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseGhost(bytes, false) }
      })

      // Assert
      expect(results).toHaveLength(12)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})

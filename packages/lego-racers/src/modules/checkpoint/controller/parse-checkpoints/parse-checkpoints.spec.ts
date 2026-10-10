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
import { encodeArrayHeader } from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { TooManyCheckpointsError } from '../../types/checkpoint-errors/checkpoint-errors.ts'
import { parseCheckpoints } from './parse-checkpoints.ts'

const checkpointBlock = (next: number, y: number): readonly number[] => [
  0x27,
  LEFT_CURLY,
  0x28,
  ...floatTokens([0, -1, 0, y]),
  0x2a,
  ...floatTokens([10, y, 2]),
  0x29,
  ...integerTokens([next, 255, 255, 255]),
  RIGHT_CURLY,
]

const checkpointFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...encodeArrayHeader(blocks.length), ...blocks.flat(), RIGHT_CURLY])

describe('parseCheckpoints', () => {
  it('reads each checkpoint and assigns progress along the loop', () => {
    // Arrange
    const bytes = checkpointFile([checkpointBlock(1, 100), checkpointBlock(0, 200)])

    // Act
    const parsed = parseCheckpoints(bytes, false)

    // Assert
    expect(parsed).toEqual({
      checkpoints: [
        { plane: [0, -1, 0, 100], point: [10, 100, 2], links: [1, 255, 255, 255], progress: 0 },
        { plane: [0, -1, 0, 200], point: [10, 200, 2], links: [0, 255, 255, 255], progress: 0.5 },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('negates the plane and point y on a mirrored track', () => {
    // Arrange
    const bytes = checkpointFile([checkpointBlock(0, 100)])

    // Act
    const [checkpoint] = parseCheckpoints(bytes, true).checkpoints

    // Assert
    expect([checkpoint?.plane, checkpoint?.point]).toEqual([
      [0, 1, 0, 100],
      [10, -100, 2],
    ])
  })

  it('rejects more than 254 checkpoints', () => {
    // Arrange
    const bytes = new Uint8Array([0x27, ...encodeArrayHeader(255)])

    // Act
    const parse = () => parseCheckpoints(bytes, false)

    // Assert
    expect(parse).toThrow(TooManyCheckpointsError)
  })

  it('rejects an unknown keyword inside a checkpoint as a syntax error', () => {
    // Arrange
    const bytes = checkpointFile([[0x27, LEFT_CURLY, 0x2b, RIGHT_CURLY]])

    // Act
    const parse = () => parseCheckpoints(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every checkpoint file in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.CPB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseCheckpoints(bytes, false) }
      })

      // Assert
      expect(results).toHaveLength(13)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
        expect({
          path,
          unassigned: parsed.checkpoints.filter(({ progress }) => progress < 0),
        }).toEqual({ path, unassigned: [] })
      }
    }
  )
})

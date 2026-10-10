import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import {
  arrayHeaderTokens,
  integerToken,
  LEFT_CURLY,
  RIGHT_CURLY,
} from '../../../../shared/testing/token-bytes.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { parseTimers } from './parse-timers.ts'

const timerFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...arrayHeaderTokens(blocks.length), ...blocks.flat(), RIGHT_CURLY])

describe('parseTimers', () => {
  it('reads plain and marked values, the identifier and the third value', () => {
    // Arrange
    const bytes = timerFile([
      [
        0x27,
        LEFT_CURLY,
        0x28,
        0x2b,
        ...integerToken(1200),
        0x29,
        0x2b,
        ...integerToken(8000),
        0x2a,
        ...integerToken(50),
        RIGHT_CURLY,
      ],
      [
        0x27,
        LEFT_CURLY,
        0x28,
        ...integerToken(1666),
        0x29,
        ...integerToken(3334),
        0x2d,
        ...integerToken(3600),
        RIGHT_CURLY,
      ],
    ])

    // Act
    const parsed = parseTimers(bytes)

    // Assert
    expect(parsed).toEqual({
      timers: [
        {
          firstValue: 1200,
          isFirstValueMarked: true,
          secondValue: 8000,
          isSecondValueRandomised: true,
          thirdValue: 0,
          identifier: 50,
        },
        {
          firstValue: 1666,
          isFirstValueMarked: false,
          secondValue: 3334,
          isSecondValueRandomised: false,
          thirdValue: 3600,
          identifier: -1,
        },
      ],
      readByteCount: bytes.byteLength - 1,
    })
  })

  it('stops after the count of an empty list', () => {
    // Arrange
    const bytes = timerFile([])

    // Act
    const parsed = parseTimers(bytes)

    // Assert
    expect(parsed).toEqual({ timers: [], readByteCount: bytes.byteLength - 3 })
  })

  it('rejects an unknown keyword inside a timer as a syntax error', () => {
    // Arrange
    const bytes = timerFile([[0x27, LEFT_CURLY, 0x2c, RIGHT_CURLY]])

    // Act
    const parse = () => parseTimers(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every timer file in the original LEGO.JAM up to the closers it never reads',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.TIB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const parsed = parseTimers(bytes)
        return {
          path,
          count: parsed.timers.length,
          unreadBytes: [...bytes.subarray(parsed.readByteCount)],
        }
      })

      // Assert
      expect(results).toHaveLength(14)
      for (const { path, count, unreadBytes } of results) {
        const expectedUnreadBytes = count === 0 ? [0x08, LEFT_CURLY, RIGHT_CURLY] : [RIGHT_CURLY]
        expect({ path, unreadBytes }).toEqual({ path, unreadBytes: expectedUnreadBytes })
      }
    }
  )
})

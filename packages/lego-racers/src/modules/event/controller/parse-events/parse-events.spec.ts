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
import { encodeArrayHeader, encodeFloat } from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderError } from '../../../token-reader/index.ts'
import { parseEvents } from './parse-events.ts'

const section = (keyword: number, blocks: readonly (readonly number[])[]): readonly number[] => [
  keyword,
  ...encodeArrayHeader(blocks.length),
  ...blocks.flat(),
  RIGHT_CURLY,
]

describe('parseEvents', () => {
  it('reads a 0x2a block with its defaults and a mirrored position', () => {
    // Arrange
    const bytes = new Uint8Array(
      section(0x2a, [
        [
          0x27,
          ...integerTokens([7]),
          LEFT_CURLY,
          0x3b,
          ...floatTokens([1, 2, 3]),
          0x40,
          ...encodeFloat(0.5),
          RIGHT_CURLY,
        ],
      ])
    )

    // Act
    const parsed = parseEvents(bytes, true)

    // Assert
    expect(parsed.events2A).toEqual([
      {
        identifier: 7,
        isBraced: false,
        keyword2cInteger: 0,
        isKeyword2dSet: false,
        keyword2eInteger: 0,
        keyword2fFloat: 1,
        keyword30Float: 1,
        keyword31Float: 30,
        keyword32Float: 300,
        objectName: null,
        isKeyword3aSet: false,
        position: [1, -2, 3],
        isKeyword3fSet: false,
        chance: 0.5,
        keyword54Integer: 0,
      },
    ])
  })

  it('reads the phase signals and the zone of a 0x51 block', () => {
    // Arrange
    const bytes = new Uint8Array(
      section(0x51, [
        [
          0x27,
          ...integerTokens([3]),
          LEFT_CURLY,
          0x27,
          0x36,
          ...integerTokens([10]),
          0x27,
          0x37,
          ...integerTokens([12]),
          0x37,
          RIGHT_CURLY,
        ],
      ])
    )

    // Act
    const parsed = parseEvents(bytes, false)

    // Assert
    expect(parsed.events51).toEqual([
      {
        identifier: 3,
        isBraced: false,
        phaseSignals: { first: 10, second: -1, third: 12 },
        zone: 2,
      },
    ])
  })

  it('reads the linked identifiers of a 0x39 section', () => {
    // Arrange
    const bytes = new Uint8Array(
      section(0x39, [
        [0x27, ...integerTokens([4]), LEFT_CURLY, 0x39, ...integerTokens([9]), RIGHT_CURLY],
      ])
    )

    // Act
    const parsed = parseEvents(bytes, false)

    // Assert
    expect(parsed.links).toEqual([{ identifier: 4, linkedIdentifier: 9 }])
  })

  it('refuses an unknown section', () => {
    // Arrange
    const bytes = new Uint8Array([0x30])

    // Act
    const parse = () => parseEvents(bytes, false)

    // Assert
    expect(parse).toThrow(TokenReaderError)
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every EVENT.EVB of the original game to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.EVB'))

      // Act
      const results = paths.map((path) => ({
        length: archive.readFile(path).length,
        parsed: parseEvents(archive.readFile(path), false),
      }))

      // Assert
      expect(results.length).toBe(14)
      expect(results.map((result) => result.parsed.readByteCount)).toEqual(
        results.map((result) => result.length)
      )
    }
  )
})

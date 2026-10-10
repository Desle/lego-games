import { UnportableFileError } from '../../../../shared/errors/gol-file-errors.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { floatTokens, LEFT_CURLY, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeFloat,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { parseHazards } from './parse-hazards.ts'

const hazardFile = (hazards: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...encodeArrayHeader(hazards.length), ...hazards.flat(), RIGHT_CURLY])

const CANNON_BODY = [
  LEFT_CURLY,
  0x37,
  ...floatTokens([1, 2, 3]),
  0x3a,
  ...encodeFloat(3),
  0x3b,
  ...encodeInteger(4),
  RIGHT_CURLY,
]

describe('parseHazards', () => {
  it('reads hazards without data, named floats and the 0x3d point lists with their block', () => {
    // Arrange
    const bytes = hazardFile([
      [0x28],
      [0x36, ...encodeString('rkflag'), ...floatTokens([0.5, 2])],
      [
        0x3d,
        LEFT_CURLY,
        0x37,
        0x07,
        ...encodeInteger(1),
        0x08,
        LEFT_CURLY,
        ...floatTokens([5, 6, 7]),
        ...encodeInteger(9),
        RIGHT_CURLY,
        0x50,
        0x33,
        ...CANNON_BODY,
        RIGHT_CURLY,
      ],
    ])

    // Act
    const parsed = parseHazards(bytes, false)

    // Assert
    expect(parsed).toEqual({
      hazards: [
        { keyword: 0x28 },
        { keyword: 0x36, name: 'rkflag', firstFloat: 0.5, secondFloat: 2 },
        {
          keyword: 0x3d,
          points: [{ position: [5, 6, 7], integer: 9 }],
          secondPoints: null,
          block: {
            firstVector: [1, 2, 3],
            secondVector: null,
            thirdVector: null,
            squaredFloat: 9,
            integer: 4,
          },
        },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('negates the y the loaders mirror', () => {
    // Arrange
    const bytes = hazardFile([
      [0x33, ...CANNON_BODY],
      [
        0x40,
        LEFT_CURLY,
        0x37,
        ...floatTokens([1, 2, 3]),
        0x47,
        ...floatTokens([4, 5, 6]),
        RIGHT_CURLY,
      ],
    ])

    // Act
    const [cannon, other] = parseHazards(bytes, true).hazards

    // Assert
    expect(cannon).toMatchObject({ firstVector: [1, -2, 3] })
    expect(other).toMatchObject({ vector: [1, -2, 3], secondVector: [4, 5, 6] })
  })

  it('refuses a hazard keyword with no class, which the original calls through null', () => {
    // Arrange
    const bytes = hazardFile([[0x31]])

    // Act
    const parse = () => parseHazards(bytes, false)

    // Assert
    expect(parse).toThrow(UnportableFileError)
  })

  it('refuses a fifth name in a 0x34 hazard', () => {
    // Arrange
    const names = ['a', 'b', 'c', 'd', 'e'].flatMap((name) => [0x42, ...encodeString(name)])
    const bytes = hazardFile([[0x34, LEFT_CURLY, ...names, RIGHT_CURLY]])

    // Act
    const parse = () => parseHazards(bytes, false)

    // Assert
    expect(parse).toThrow(UnportableFileError)
  })

  it('rejects an unknown keyword inside a block as a syntax error', () => {
    // Arrange
    const bytes = hazardFile([[0x43, LEFT_CURLY, 0x37, RIGHT_CURLY]])

    // Act
    const parse = () => parseHazards(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every hazard file in the original LEGO.JAM to its last byte, but the curly of empty lists',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.HZB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const parsed = parseHazards(bytes, false)
        return {
          path,
          count: parsed.hazards.length,
          unreadBytes: [...bytes.subarray(parsed.readByteCount)],
        }
      })

      // Assert
      expect(results).toHaveLength(14)
      for (const { path, count, unreadBytes } of results) {
        expect({ path, unreadBytes }).toEqual({
          path,
          unreadBytes: count === 0 ? [RIGHT_CURLY] : [],
        })
      }
    }
  )
})

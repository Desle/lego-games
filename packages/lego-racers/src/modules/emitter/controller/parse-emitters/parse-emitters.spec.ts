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
import { parseEmitters } from './parse-emitters.ts'

const emitterFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...encodeArrayHeader(blocks.length), ...blocks.flat(), RIGHT_CURLY])

const emitterBlock = (name: string, body: readonly number[]): readonly number[] => [
  0x27,
  ...encodeString(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

describe('parseEmitters', () => {
  it('reads every keyword of an emitter block', () => {
    // Arrange
    const bytes = emitterFile([
      emitterBlock('grassemt', [
        0x28,
        ...encodeFloat(9.75),
        0x29,
        ...encodeFloat(-300.5),
        0x2c,
        ...encodeFloat(1.5),
        0x2d,
        ...encodeFloat(2.5),
        0x31,
        ...encodeFloat(4),
        0x32,
        ...encodeFloat(5),
        0x33,
        ...encodeFloat(100),
        0x2f,
        ...encodeInteger(700),
        0x30,
        ...encodeInteger(250),
        0x2a,
        ...floatTokens([0, 0, -52.25]),
        0x2b,
        0x07,
        ...encodeInteger(2),
        0x08,
        LEFT_CURLY,
        ...floatTokens([0, 0, 22, 0.5, 2, 20]),
        RIGHT_CURLY,
        0x35,
        ...encodeInteger(0x114),
        0x2e,
        ...encodeInteger(1),
        0x34,
        ...encodeString('graspart'),
      ]),
    ])

    // Act
    const parsed = parseEmitters(bytes)

    // Assert
    expect(parsed).toEqual({
      emitters: [
        {
          name: 'grassemt',
          firstTruncatedValue: 9,
          secondTruncatedValue: 0xd4,
          vector: [0, 0, -52.25],
          points: [
            [0, 0, 22],
            [0.5, 2, 20],
          ],
          firstFloat: 1.5,
          secondFloat: 2.5,
          thirdFloat: 4,
          fourthFloat: 5,
          fifthFloat: 100,
          entryIndex: 1,
          firstInteger: 700,
          secondInteger: 250,
          thirdInteger: 0x14,
          linkedName: 'graspart',
        },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('starts from the reset values of 0x0048a0e0', () => {
    // Arrange
    const bytes = emitterFile([emitterBlock('empty', [])])

    // Act
    const [emitter] = parseEmitters(bytes).emitters

    // Assert
    expect(emitter).toMatchObject({
      firstFloat: 1,
      secondFloat: 1,
      secondInteger: -1,
      entryIndex: null,
    })
  })

  it('rejects an unknown keyword as a syntax error', () => {
    // Arrange
    const bytes = emitterFile([emitterBlock('bad', [0x36])])

    // Act
    const parse = () => parseEmitters(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every emitter file in the original LEGO.JAM to its last byte, but the curly of empty lists',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.EMB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const parsed = parseEmitters(bytes)
        return {
          path,
          count: parsed.emitters.length,
          unreadBytes: [...bytes.subarray(parsed.readByteCount)],
        }
      })

      // Assert
      expect(results).toHaveLength(17)
      for (const { path, count, unreadBytes } of results) {
        expect({ path, unreadBytes }).toEqual({
          path,
          unreadBytes: count === 0 ? [RIGHT_CURLY] : [],
        })
      }
    }
  )
})

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
import { TriggerFileKind } from '../../types/trigger-keyword/trigger-keyword.ts'
import { parseTriggers } from './parse-triggers.ts'

const triggerFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...encodeArrayHeader(blocks.length), ...blocks.flat(), RIGHT_CURLY])

const SHARED_BLOCK = [
  0x27,
  LEFT_CURLY,
  0x29,
  ...floatTokens([-46.5, -689.5, 23.75]),
  0x2a,
  ...encodeFloat(218.25),
  0x2b,
  ...encodeInteger(18),
  0x2f,
  RIGHT_CURLY,
]

const MAIN_BLOCK = [
  0x27,
  LEFT_CURLY,
  0x2c,
  0x2d,
  ...encodeString('startfin'),
  0x2e,
  ...encodeInteger(1),
  RIGHT_CURLY,
]

describe('parseTriggers', () => {
  it('reads the shared keywords and leaves the closing curly unread', () => {
    // Arrange
    const bytes = triggerFile([SHARED_BLOCK])

    // Act
    const parsed = parseTriggers(bytes, TriggerFileKind.ENVIRONMENT, false)

    // Assert
    expect(parsed).toEqual({
      triggers: [
        {
          position: [-46.5, -689.5, 23.75],
          radius: 218.25,
          firstInteger: 18,
          isFlag4Set: true,
          isFlag1000Set: false,
          objectName: null,
          secondInteger: null,
        },
      ],
      readByteCount: bytes.byteLength - 1,
    })
  })

  it('reads the main-only keywords in a main trigger file', () => {
    // Arrange
    const bytes = triggerFile([MAIN_BLOCK])

    // Act
    const [trigger] = parseTriggers(bytes, TriggerFileKind.MAIN, false).triggers

    // Assert
    expect(trigger).toMatchObject({
      isFlag1000Set: true,
      objectName: 'startfin',
      secondInteger: 1,
    })
  })

  it('rejects the main-only keywords in an environment file as a syntax error', () => {
    // Arrange
    const bytes = triggerFile([MAIN_BLOCK])

    // Act
    const parse = () => parseTriggers(bytes, TriggerFileKind.ENVIRONMENT, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it('negates the position y on a mirrored track', () => {
    // Arrange
    const bytes = triggerFile([SHARED_BLOCK])

    // Act
    const [trigger] = parseTriggers(bytes, TriggerFileKind.MAIN, true).triggers

    // Assert
    expect(trigger?.position).toEqual([-46.5, 689.5, 23.75])
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every trigger file in the original LEGO.JAM up to its unread closing curly',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.TRB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const kind = path.toUpperCase().endsWith('ENVIRON.TRB')
          ? TriggerFileKind.ENVIRONMENT
          : TriggerFileKind.MAIN
        const parsed = parseTriggers(bytes, kind, false)
        return { path, unreadBytes: [...bytes.subarray(parsed.readByteCount)] }
      })

      // Assert
      expect(results).toHaveLength(28)
      for (const { path, unreadBytes } of results) {
        expect({ path, unreadBytes }).toEqual({ path, unreadBytes: [RIGHT_CURLY] })
      }
    }
  )
})

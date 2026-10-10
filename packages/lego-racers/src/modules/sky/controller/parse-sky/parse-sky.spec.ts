import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import {
  floatToken,
  integerToken,
  integerTokens,
  LEFT_CURLY,
  RIGHT_CURLY,
  stringToken,
} from '../../../../shared/testing/token-bytes.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { parseSky } from './parse-sky.ts'

const bracketedCount = (count: number): readonly number[] => [0x07, ...integerToken(count), 0x08]

const setting = (name: string, keyframes: readonly (readonly number[])[]): readonly number[] => [
  0x27,
  ...bracketedCount(keyframes.length),
  ...stringToken(name),
  LEFT_CURLY,
  ...keyframes.flatMap((body) => [0x27, LEFT_CURLY, ...body, RIGHT_CURLY]),
  RIGHT_CURLY,
]

const skyFile = (settings: readonly (readonly number[])[], tail: readonly number[]): Uint8Array =>
  new Uint8Array([
    0x2c,
    ...bracketedCount(settings.length),
    LEFT_CURLY,
    ...settings.flat(),
    RIGHT_CURLY,
    ...tail,
  ])

describe('parseSky', () => {
  it('reads settings, keyframes, the selected setting and the float', () => {
    // Arrange
    const bytes = skyFile(
      [
        setting('openair', [
          [
            0x28,
            ...integerToken(5000),
            0x29,
            ...integerTokens([250, 250, 0x178]),
            0x2b,
            ...integerTokens([25, 25, 255]),
          ],
        ]),
        setting('castle', [[]]),
      ],
      [0x2d, ...stringToken('openair'), 0x2e, ...floatToken(0.5)]
    )

    // Act
    const parsed = parseSky(bytes)

    // Assert
    expect(parsed).toEqual({
      settings: [
        {
          name: 'openair',
          keyframes: [
            {
              integer: 5000,
              firstBytes: [250, 250, 0x78],
              secondBytes: [255, 255, 255],
              thirdBytes: [25, 25, 255],
            },
          ],
        },
        {
          name: 'castle',
          keyframes: [
            {
              integer: 1000,
              firstBytes: [255, 255, 255],
              secondBytes: [255, 255, 255],
              thirdBytes: [255, 255, 255],
            },
          ],
        },
      ],
      selectedSettingName: 'openair',
      float: 0.5,
      readByteCount: bytes.byteLength,
    })
  })

  it('drops the token after the settings when it is not 0x2d', () => {
    // Arrange
    const bytes = skyFile([], [0x30, 0x2e, ...floatToken(2)])

    // Act
    const parsed = parseSky(bytes)

    // Assert
    expect([parsed.selectedSettingName, parsed.float]).toEqual([null, 2])
  })

  it('rejects an unknown keyword inside a keyframe as a syntax error', () => {
    // Arrange
    const bytes = skyFile([setting('bad', [[0x2c]])], [])

    // Act
    const parse = () => parseSky(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every sky file in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.SKB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseSky(bytes) }
      })

      // Assert
      expect(results).toHaveLength(14)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})

import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { floatTokens, integerTokens, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeInteger,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { parseComputerRacerRoute } from './parse-computer-racer-route.ts'

const SAMPLE = [-3, 0x1234, 1, 2, 3, 4, 5, 6, 7, 0x1ff] as const

const route = (sampleIndex: number): Uint8Array =>
  new Uint8Array([
    0x29,
    ...floatTokens([1, 2, 3]),
    0x28,
    ...floatTokens([0, 0.5, 0, 0.5]),
    0x2a,
    ...floatTokens([4, 5, 6]),
    0x2b,
    ...floatTokens([0.5, 0, 0.5, 0]),
    0x2c,
    ...encodeInteger(77536),
    0x2d,
    ...encodeInteger(sampleIndex),
    0x50,
    0x27,
    ...encodeArrayHeader(1),
    ...integerTokens(SAMPLE),
    RIGHT_CURLY,
  ])

describe('parseComputerRacerRoute', () => {
  it('reads the vectors, quaternions, integers and samples, skipping unknown tokens', () => {
    // Arrange
    const bytes = route(0)

    // Act
    const parsed = parseComputerRacerRoute(bytes, false)

    // Assert
    expect(parsed).toEqual({
      firstVector: [1, 2, 3],
      firstQuaternion: [0, 0.5, 0, 0.5],
      secondVector: [4, 5, 6],
      secondQuaternion: [0.5, 0, 0.5, 0],
      firstInteger: 77536,
      sampleIndex: 0,
      samples: [{ first: -3, second: 0x1234, bytes: [1, 2, 3, 4, 5, 6, 7, 0xff] }],
      readByteCount: bytes.byteLength,
    })
  })

  it('mirrors every y component and the sample fields the loader negates or swaps', () => {
    // Arrange
    const bytes = route(0)

    // Act
    const parsed = parseComputerRacerRoute(bytes, true)

    // Assert
    expect(parsed).toMatchObject({
      firstVector: [1, -2, 3],
      firstQuaternion: [0, -0.5, 0, -0.5],
      secondVector: [4, -5, 6],
      samples: [{ first: -3, second: -0x1234, bytes: [1, 2, 0xfd, 4, 0xfb, 7, 6, 0xff] }],
    })
  })

  it('starts from the reset values when a keyword is absent', () => {
    // Arrange
    const bytes = new Uint8Array([0x27, ...encodeArrayHeader(1), ...integerTokens(SAMPLE), 0x06])

    // Act
    const parsed = parseComputerRacerRoute(bytes, false)

    // Assert
    expect(parsed).toMatchObject({
      firstVector: [0, 0, 0],
      firstQuaternion: [0, 0, 0, 1],
      secondQuaternion: [0, 0, 0, 1],
      firstInteger: 0,
      sampleIndex: 0,
    })
  })

  it('rejects a sample index that is not below the sample count', () => {
    // Arrange
    const bytes = route(1)

    // Act
    const parse = () => parseComputerRacerRoute(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.INVALID_VALUE }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every computer racer route in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.RRB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseComputerRacerRoute(bytes, false) }
      })

      // Assert
      expect(results).toHaveLength(208)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})

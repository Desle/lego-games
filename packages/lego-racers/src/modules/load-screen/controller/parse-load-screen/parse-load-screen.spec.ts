import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import {
  arrayHeaderTokens,
  floatTokens,
  integerToken,
  LEFT_CURLY,
  RIGHT_CURLY,
  stringToken,
} from '../../../../shared/testing/token-bytes.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseLoadScreen } from './parse-load-screen.ts'

describe('parseLoadScreen', () => {
  it('reads the image name, string index and points, skipping unknown keywords', () => {
    // Arrange
    const bytes = new Uint8Array([
      0x27,
      LEFT_CURLY,
      0x28,
      ...stringToken('rkr'),
      0x2a,
      ...integerToken(3),
      0x40,
      0x29,
      ...arrayHeaderTokens(2),
      ...floatTokens([0.125, 0.875, 0.25, 0.875]),
      RIGHT_CURLY,
      RIGHT_CURLY,
    ])

    // Act
    const parsed = parseLoadScreen(bytes)

    // Assert
    expect(parsed).toEqual({
      imageName: 'rkr',
      points: [
        [0.125, 0.875],
        [0.25, 0.875],
      ],
      stringIndex: 3,
      readByteCount: bytes.byteLength,
    })
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every load screen in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.LSB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseLoadScreen(bytes) }
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

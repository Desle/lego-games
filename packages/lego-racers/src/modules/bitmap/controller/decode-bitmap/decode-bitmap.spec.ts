import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getBitmapColors } from '../../types/bitmap-colors/bitmap-colors.ts'
import { InvalidBitmapError } from '../../types/bitmap-errors/bitmap-errors.ts'
import { decodeBitmap } from './decode-bitmap.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

// SHA-256 of the RGBA colors, from an independent Python prototype of the same decoder.
const REFERENCE_COLOR_HASHES = [
  [
    'GAMEDATA\\COMMON\\SPEED.BMP',
    'ac4786479938c1a2b4c40501ce3ae8cecf84b111e4ca567b2d8085a9221e0141',
  ],
  [
    'GAMEDATA\\COMMON\\GRAPPLE.BMP',
    '56a62ba1245bb4774e3b16d53cb63a70b10b18096b42585029b95c2980401c76',
  ],
  ['MENUDATA\\BACKDRP.BMP', 'f7c6f03f0a1efb73d674e177f24c60e4b91cbdc09c5c511a1a3541086a8887b3'],
  [
    'MENUDATA\\C_AWARD1\\EX10.BMP',
    'e9fafdc4ff4f3cf610ef9bf71727ac4138466d35bae81fd20d12f468bdb00db0',
  ],
  [
    'MENUDATA\\DANISH\\FONT_HLP.BMP',
    '917cc4e44175c9515ddb4cea771684998e88ddf771c21c88bbf16f2156d595d1',
  ],
]

// One-row, 29-pixel, 8-bit bitmap with one palette color and one LZSS block:
// literal 0, then a 28-byte back-reference at distance 1, then the end marker.
const createCompressedBitmap = (): Uint8Array =>
  new Uint8Array([
    0x08, 0x00, 29, 0, 1, 0, 0x30, 0x20, 0x10, 29, 0, 7, 0, 0x00, 0xc0, 0x00, 0x01, 0x0a, 0x00,
    0x00,
  ])

describe('decodeBitmap', () => {
  it('reads the header and the BGR palette', () => {
    // Arrange
    const file = createCompressedBitmap()

    // Act
    const bitmap = decodeBitmap(file)

    // Assert
    expect(bitmap).toMatchObject({
      width: 29,
      height: 1,
      bitsPerPixel: 8,
      colorCount: 1,
      stride: 32,
    })
    expect([...bitmap.palette.subarray(0, 8)]).toEqual([0x10, 0x20, 0x30, 0xff, 0, 0, 0, 0])
  })

  it('decompresses an LZSS block into the row', () => {
    // Arrange
    const file = createCompressedBitmap()

    // Act
    const bitmap = decodeBitmap(file)

    // Assert
    expect([...bitmap.pixels.subarray(0, 29)]).toEqual(new Array<number>(29).fill(0))
    expect(getBitmapColors(bitmap).subarray(0, 4)).toEqual(new Uint8Array([0x10, 0x20, 0x30, 0xff]))
  })

  it('copies a block stored without compression', () => {
    // Arrange
    const file = new Uint8Array([
      0x98, 0x00, 2, 0, 1, 0, 6, 0, 6, 0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    ])

    // Act
    const colors = getBitmapColors(decodeBitmap(file))

    // Assert
    expect([...colors]).toEqual([0x03, 0x02, 0x01, 0xff, 0x06, 0x05, 0x04, 0xff])
  })

  it('splits one block across rows, top row first', () => {
    // Arrange
    const file = new Uint8Array([0x98, 0x00, 1, 0, 2, 0, 6, 0, 6, 0, 1, 2, 3, 4, 5, 6])

    // Act
    const bitmap = decodeBitmap(file)

    // Assert
    expect([...bitmap.pixels]).toEqual([1, 2, 3, 0, 4, 5, 6, 0])
  })

  it.each([0x00, 0x0c, 0x10, 0x1c])('rejects the bit depth %i like the original', (kind) => {
    // Arrange
    const file = new Uint8Array([kind, 0, 1, 0, 1, 0, 0, 0, 0, 0])

    // Act
    const decode = () => decodeBitmap(file)

    // Assert
    expect(decode).toThrow(new InvalidBitmapError('Invalid BMP file'))
  })

  it('rejects truncated pixel data', () => {
    // Arrange
    const file = new Uint8Array([0x98, 0x00, 2, 0, 1, 0, 6, 0, 6, 0, 1, 2])

    // Act
    const decode = () => decodeBitmap(file)

    // Assert
    expect(decode).toThrow(InvalidBitmapError)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'decodes every bitmap in the original LEGO.JAM, matching the reference colors',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.endsWith('.BMP'))

      // Act
      const bitmaps = new Map(paths.map((path) => [path, decodeBitmap(archive.readFile(path))]))

      // Assert
      expect(bitmaps.size).toBe(1616)
      for (const [path, expectedHash] of REFERENCE_COLOR_HASHES) {
        const bitmap = bitmaps.get(path ?? '')
        expect(bitmap).toBeDefined()
        const hash = createHash('sha256').update(getBitmapColors(bitmap!)).digest('hex')
        expect(hash).toBe(expectedHash)
      }
    }
  )
})

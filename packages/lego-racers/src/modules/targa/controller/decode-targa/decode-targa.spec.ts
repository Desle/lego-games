import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getBitmapColors } from '../../../bitmap/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import {
  InvalidTargaError,
  UnsupportedTargaDepthError,
} from '../../types/targa-errors/targa-errors.ts'
import { decodeTarga } from './decode-targa.ts'

type TestHeader = {
  readonly identifierLength?: number
  readonly colorMapType?: number
  readonly imageType?: number
  readonly colorMapLength?: number
  readonly colorMapEntryBits?: number
  readonly width: number
  readonly height: number
  readonly bitsPerPixel: number
}

const getFile = (header: TestHeader, body: readonly number[]): Uint8Array =>
  new Uint8Array([
    header.identifierLength ?? 0,
    header.colorMapType ?? 0,
    header.imageType ?? 2,
    0,
    0,
    (header.colorMapLength ?? 0) & 0xff,
    (header.colorMapLength ?? 0) >> 8,
    header.colorMapEntryBits ?? 0,
    0,
    0,
    0,
    0,
    header.width & 0xff,
    header.width >> 8,
    header.height & 0xff,
    header.height >> 8,
    header.bitsPerPixel,
    0,
    ...body,
  ])

describe('decodeTarga', () => {
  it('stores the first file row as the last row unless texture flag 4 keeps it first', () => {
    // Arrange
    const header = { width: 1, height: 2, bitsPerPixel: 32 }
    const file = getFile(header, [1, 2, 3, 4, 5, 6, 7, 8])

    // Act
    const flipped = decodeTarga(file, { isFirstRowOnTop: false })
    const kept = decodeTarga(file, { isFirstRowOnTop: true })

    // Assert
    expect([...flipped.pixels]).toEqual([5, 6, 7, 8, 1, 2, 3, 4])
    expect([...kept.pixels]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('reads 32-bit pixels as blue, green, red, alpha', () => {
    // Arrange
    const file = getFile({ width: 1, height: 1, bitsPerPixel: 32 }, [10, 20, 30, 40])

    // Act
    const bitmap = decodeTarga(file, { isFirstRowOnTop: true })

    // Assert
    expect(bitmap.bitsPerPixel).toBe(32)
    expect([...getBitmapColors(bitmap)]).toEqual([30, 20, 10, 40])
  })

  it('reads 24-bit pixels with full alpha and skips the identifier', () => {
    // Arrange
    const file = getFile(
      { identifierLength: 2, width: 4, height: 1, bitsPerPixel: 24 },
      [9, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    )

    // Act
    const bitmap = decodeTarga(file, { isFirstRowOnTop: true })

    // Assert
    expect(bitmap.stride).toBe(12)
    expect([...getBitmapColors(bitmap).subarray(0, 8)]).toEqual([3, 2, 1, 255, 6, 5, 4, 255])
  })

  it('advances by the padded row size, shearing a 24-bit image that is not a multiple of four bytes', () => {
    // Arrange
    const file = getFile({ width: 1, height: 2, bitsPerPixel: 24 }, [1, 2, 3, 4, 5, 6, 7, 8])

    // Act
    const bitmap = decodeTarga(file, { isFirstRowOnTop: true })

    // Assert
    expect(bitmap.stride).toBe(4)
    expect([...bitmap.pixels]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('reads the colour map of a palettised image as red, green, blue, alpha entries', () => {
    // Arrange
    const file = getFile(
      {
        colorMapType: 1,
        imageType: 1,
        colorMapLength: 2,
        colorMapEntryBits: 24,
        width: 2,
        height: 1,
        bitsPerPixel: 8,
      },
      [1, 2, 3, 4, 5, 6, 1, 0, 0, 0]
    )

    // Act
    const bitmap = decodeTarga(file, { isFirstRowOnTop: true })

    // Assert
    expect(bitmap.colorCount).toBe(2)
    expect([...bitmap.palette.subarray(0, 8)]).toEqual([3, 2, 1, 255, 6, 5, 4, 255])
    expect([...getBitmapColors(bitmap)]).toEqual([6, 5, 4, 255, 3, 2, 1, 255])
  })

  it('expands 15-bit and 16-bit colour map entries to five bits per channel', () => {
    // Arrange
    const body = [0x1f, 0x7c, 0]
    const header = { colorMapType: 1, colorMapLength: 1, width: 1, height: 1, bitsPerPixel: 8 }

    // Act
    const fifteen = decodeTarga(getFile({ ...header, colorMapEntryBits: 15 }, body), {
      isFirstRowOnTop: true,
    })
    const sixteen = decodeTarga(getFile({ ...header, colorMapEntryBits: 16 }, body), {
      isFirstRowOnTop: true,
    })

    // Assert
    expect([...fifteen.palette.subarray(0, 4)]).toEqual([0xf8, 0, 0xf8, 255])
    expect([...sixteen.palette.subarray(0, 4)]).toEqual([0xf8, 0, 0xf8, 0])
  })

  it('decodes run-length packets, stopping at a packet that would pass the row width', () => {
    // Arrange
    const header = { imageType: 10, width: 4, height: 1, bitsPerPixel: 32 }
    const file = getFile(header, [0x81, 1, 2, 3, 4, 0x00, 5, 6, 7, 8, 0x81, 9, 9, 9, 9])

    // Act
    const bitmap = decodeTarga(file, { isFirstRowOnTop: true })

    // Assert
    expect([...bitmap.pixels]).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0])
  })

  it('refuses depths the loader has no case for and depths that depend on the display surface', () => {
    // Arrange
    const unknown = getFile({ width: 1, height: 1, bitsPerPixel: 12 }, [0, 0])
    const sixteen = getFile({ width: 1, height: 1, bitsPerPixel: 16 }, [0, 0])

    // Act
    // Assert
    expect(() => decodeTarga(unknown, { isFirstRowOnTop: true })).toThrow(
      UnsupportedTargaDepthError
    )
    expect(() => decodeTarga(sixteen, { isFirstRowOnTop: true })).toThrow(InvalidTargaError)
  })

  it('fails when the pixel data ends before the last row', () => {
    // Arrange
    const file = getFile({ width: 1, height: 2, bitsPerPixel: 32 }, [1, 2, 3, 4])

    // Act
    // Assert
    expect(() => decodeTarga(file, { isFirstRowOnTop: true })).toThrow(InvalidTargaError)
    expect(() => decodeTarga(new Uint8Array(4), { isFirstRowOnTop: true })).toThrow(
      InvalidTargaError
    )
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'decodes every .TGA in the original LEGO.JAM as a 32 by 32 image with alpha',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.endsWith('.TGA'))

      // Act
      const bitmaps = paths.map((path) =>
        decodeTarga(archive.readFile(path), { isFirstRowOnTop: false })
      )

      // Assert
      expect(paths).toHaveLength(9)
      for (const bitmap of bitmaps) {
        expect([bitmap.width, bitmap.height, bitmap.bitsPerPixel]).toEqual([32, 32, 32])
      }
    }
  )
})

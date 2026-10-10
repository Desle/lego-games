import { InvalidBitmapError } from '../bitmap-errors/bitmap-errors.ts'
import type { BitmapHeader } from '../bitmap.types.ts'

const HEADER_LENGTH = 6
const BITS_PER_PIXEL_MASK = 0x3c
const NO_PALETTE_FLAG = 0x80
const MAXIMUM_PALETTED_BITS_PER_PIXEL = 8
const SUPPORTED_BITS_PER_PIXEL: readonly number[] = [4, 8, 24, 32]
const PALETTE_ENTRY_COUNT = 256
const STORED_PALETTE_ENTRY_LENGTH = 3

export const getIsWindowsBitmap = (file: Uint8Array): boolean =>
  file[0] === 0x42 && file[1] === 0x4d

// GolDP.dll 0x10018da0, the branch for files that don't start with "BM".
export const readBitmapHeader = (file: Uint8Array): BitmapHeader => {
  if (file.byteLength < HEADER_LENGTH) throw new InvalidBitmapError('Unexpected end of BMP data')
  const kind = file[0] ?? 0
  const bitsPerPixel = kind & BITS_PER_PIXEL_MASK
  if (!SUPPORTED_BITS_PER_PIXEL.includes(bitsPerPixel)) throw new InvalidBitmapError()

  const isPaletted = bitsPerPixel <= MAXIMUM_PALETTED_BITS_PER_PIXEL
  const colorCount = isPaletted && (kind & NO_PALETTE_FLAG) === 0 ? (file[1] ?? 0) + 1 : 0
  const width = (file[2] ?? 0) | ((file[3] ?? 0) << 8)
  const height = (file[4] ?? 0) | ((file[5] ?? 0) << 8)

  const pixelDataOffset = HEADER_LENGTH + colorCount * STORED_PALETTE_ENTRY_LENGTH
  if (pixelDataOffset > file.byteLength) throw new InvalidBitmapError('Unexpected end of BMP data')
  const palette = new Uint8Array(PALETTE_ENTRY_COUNT * 4)
  for (let index = 0; index < colorCount; index++) {
    const stored = HEADER_LENGTH + index * STORED_PALETTE_ENTRY_LENGTH
    palette.set([file[stored + 2] ?? 0, file[stored + 1] ?? 0, file[stored] ?? 0, 0xff], index * 4)
  }

  return Object.freeze({
    width,
    height,
    bitsPerPixel,
    colorCount,
    palette,
    stride: ((width * bitsPerPixel + 31) >>> 3) & ~3,
    pixelDataOffset,
  })
}

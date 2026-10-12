import type { RgbaImage } from '../../types/export.types.ts'
import type { WindowsBitmapHeader } from './windows-bitmap.types.ts'

const FILE_HEADER_LENGTH = 14
const PALETTE_ENTRY_LENGTH = 4
const MINIMUM_INFORMATION_HEADER_LENGTH = 40
const SUPPORTED_BITS_PER_PIXEL = [1, 4, 8, 24, 32]
const UNCOMPRESSED = 0
const BITFIELDS = 3

const getHeader = (file: Uint8Array): WindowsBitmapHeader => {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  if (
    file.length < FILE_HEADER_LENGTH + MINIMUM_INFORMATION_HEADER_LENGTH ||
    view.getUint16(0) !== 0x424d
  ) {
    throw new Error('Not a Windows bitmap')
  }
  const informationLength = view.getUint32(FILE_HEADER_LENGTH, true)
  const rawHeight = view.getInt32(FILE_HEADER_LENGTH + 8, true)
  const bitsPerPixel = view.getUint16(FILE_HEADER_LENGTH + 14, true)
  const compression = view.getUint32(FILE_HEADER_LENGTH + 16, true)
  if (!SUPPORTED_BITS_PER_PIXEL.includes(bitsPerPixel)) {
    throw new Error(`Unsupported bitmap depth ${String(bitsPerPixel)}`)
  }
  if (compression !== UNCOMPRESSED && compression !== BITFIELDS) {
    throw new Error(`Unsupported bitmap compression ${String(compression)}`)
  }
  const declaredColorCount = view.getUint32(FILE_HEADER_LENGTH + 32, true)
  return Object.freeze({
    width: view.getInt32(FILE_HEADER_LENGTH + 4, true),
    height: Math.abs(rawHeight),
    isTopDown: rawHeight < 0,
    bitsPerPixel,
    paletteOffset: FILE_HEADER_LENGTH + informationLength,
    paletteColorCount: bitsPerPixel <= 8 ? declaredColorCount || 2 ** bitsPerPixel : 0,
    pixelDataOffset: view.getUint32(10, true),
  })
}

const getPixelColor = (
  file: Uint8Array,
  header: WindowsBitmapHeader,
  rowStart: number,
  column: number
): readonly [number, number, number] => {
  if (header.bitsPerPixel >= 24) {
    const start = rowStart + column * (header.bitsPerPixel / 8)
    return [file[start + 2] ?? 0, file[start + 1] ?? 0, file[start] ?? 0]
  }
  const bitOffset = column * header.bitsPerPixel
  const packed = file[rowStart + (bitOffset >> 3)] ?? 0
  const shift = 8 - header.bitsPerPixel - (bitOffset & 7)
  const index = (packed >> shift) & ((1 << header.bitsPerPixel) - 1)
  const start =
    header.paletteOffset + Math.min(index, header.paletteColorCount - 1) * PALETTE_ENTRY_LENGTH
  return [file[start + 2] ?? 0, file[start + 1] ?? 0, file[start] ?? 0]
}

// A standard uncompressed Windows BMP (1, 4, 8, 24 or 32 bits per pixel) as opaque RGBA.
export const decodeWindowsBitmap = (file: Uint8Array): RgbaImage => {
  const header = getHeader(file)
  const stride = ((header.width * header.bitsPerPixel + 31) >> 5) << 2
  const colors = new Uint8Array(header.width * header.height * 4)
  for (let row = 0; row < header.height; row++) {
    const sourceRow = header.isTopDown ? row : header.height - 1 - row
    const rowStart = header.pixelDataOffset + sourceRow * stride
    for (let column = 0; column < header.width; column++) {
      const [red, green, blue] = getPixelColor(file, header, rowStart, column)
      colors.set([red, green, blue, 255], (row * header.width + column) * 4)
    }
  }
  return Object.freeze({ width: header.width, height: header.height, colors })
}

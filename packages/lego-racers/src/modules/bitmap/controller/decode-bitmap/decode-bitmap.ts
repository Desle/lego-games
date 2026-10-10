import { createBitmapBlockReader } from '../../types/bitmap-block-reader/bitmap-block-reader.ts'
import { InvalidBitmapError } from '../../types/bitmap-errors/bitmap-errors.ts'
import { getIsWindowsBitmap, readBitmapHeader } from '../../types/bitmap-header/bitmap-header.ts'
import type { Bitmap } from '../../types/bitmap.types.ts'

// GolDP.dll 0x10019fe0: a 4-bit row holds width * 4 + 4 bits, other depths width * depth.
const getRowLength = (width: number, bitsPerPixel: number): number =>
  (bitsPerPixel === 4 ? width * 4 + 4 : width * bitsPerPixel) >> 3

export const decodeBitmap = (file: Uint8Array): Bitmap => {
  if (getIsWindowsBitmap(file)) {
    throw new InvalidBitmapError('Windows BMP files are not used inside LEGO.JAM')
  }
  const header = readBitmapHeader(file)
  const rowLength = getRowLength(header.width, header.bitsPerPixel)
  const pixels = new Uint8Array(header.stride * header.height)
  const blockReader = createBitmapBlockReader()
  let position = header.pixelDataOffset
  for (let rowIndex = 0; rowIndex < header.height; rowIndex++) {
    const rowStart = rowIndex * header.stride
    position = blockReader.readRow(file, position, pixels.subarray(rowStart, rowStart + rowLength))
  }
  return Object.freeze({
    width: header.width,
    height: header.height,
    bitsPerPixel: header.bitsPerPixel,
    colorCount: header.colorCount,
    palette: header.palette,
    stride: header.stride,
    pixels,
  })
}

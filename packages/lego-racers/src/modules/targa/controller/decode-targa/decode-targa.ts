import type { Bitmap } from '../../../bitmap/index.ts'
import { InvalidTargaError } from '../../types/targa-errors/targa-errors.ts'
import type { TargaDecodeOptions, TargaHeader } from '../../types/targa.types.ts'
import { readTargaHeader } from '../read-targa-header/read-targa-header.ts'

const RUN_LENGTH_FIRST_TYPE = 9
const RUN_LENGTH_FLAG = 0x80
const RUN_LENGTH_COUNT_MASK = 0x7f
const NATIVE_DEPTHS: readonly number[] = [8, 24, 32]

// GolDP.dll 0x1002ad40: the Targa packet decoder, given the `stride` bytes the loader read for one row. A packet
// is a byte whose low seven bits are the pixel count less one and whose top bit marks a run (one pixel repeated)
// rather than raw pixels; it stops at the first packet that would pass the row's width.
const decodeRunLengthRow = (
  source: Uint8Array,
  width: number,
  bytesPerPixel: number
): Uint8Array => {
  const row = new Uint8Array(width * bytesPerPixel)
  let sourceOffset = 0
  let pixelCount = 0
  while (pixelCount < width) {
    const packet = source[sourceOffset] ?? 0
    sourceOffset++
    const count = (packet & RUN_LENGTH_COUNT_MASK) + 1
    if (pixelCount + count > width) break
    const isRun = (packet & RUN_LENGTH_FLAG) !== 0
    for (let pixel = 0; pixel < count; pixel++) {
      const start = isRun ? sourceOffset : sourceOffset + pixel * bytesPerPixel
      row.set(source.subarray(start, start + bytesPerPixel), (pixelCount + pixel) * bytesPerPixel)
    }
    sourceOffset += isRun ? bytesPerPixel : count * bytesPerPixel
    pixelCount += count
  }
  return row
}

// One row as the loader hands it to the pixel conversion: the bytes read, or the decoded packets.
const getRowBytes = (header: TargaHeader, chunk: Uint8Array): Uint8Array =>
  header.imageType >= RUN_LENGTH_FIRST_TYPE
    ? decodeRunLengthRow(chunk, header.width, (header.bitsPerPixel + 7) >> 3)
    : chunk

// GolDP.dll 0x1002ae50 (Targa vtable slot 7): reads `stride` bytes per row from the pixel data offset, one row
// after the other, and stores the first file row as the last texture row unless texture flag 4 is set. The file
// offset advances by the bytes read, not by what a row used, so a 24-bit image whose rows are not a multiple of
// four bytes shears exactly as in the original. Depths whose conversion depends on the display surface (4 and
// 16 bits) are refused.
export const decodeTarga = (file: Uint8Array, options: TargaDecodeOptions): Bitmap => {
  const header = readTargaHeader(file)
  if (!NATIVE_DEPTHS.includes(header.bitsPerPixel)) {
    throw new InvalidTargaError(
      `${String(header.bitsPerPixel)}-bit Targa pixels convert through the display surface format`
    )
  }
  const pixels = new Uint8Array(header.stride * header.height)
  let offset = header.pixelDataOffset
  for (let row = 0; row < header.height; row++) {
    if (offset >= file.length) throw new InvalidTargaError('Unable to read')
    const chunk = file.subarray(offset, offset + header.stride)
    const rowBytes = getRowBytes(header, chunk)
    const targetRow = options.isFirstRowOnTop ? row : header.height - 1 - row
    pixels.set(rowBytes.subarray(0, header.stride), targetRow * header.stride)
    offset += chunk.length
  }
  return Object.freeze({
    width: header.width,
    height: header.height,
    bitsPerPixel: header.bitsPerPixel,
    colorCount: header.paletteCount,
    palette: header.palette,
    stride: header.stride,
    pixels,
  })
}

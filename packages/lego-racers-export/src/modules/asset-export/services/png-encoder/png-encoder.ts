import { crc32, deflateSync } from 'node:zlib'
import type { RgbaImage } from '../../types/export.types.ts'

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const BYTES_PER_PIXEL = 4
const BIT_DEPTH = 8
const COLOR_TYPE_RGBA = 6
const HEADER_LENGTH = 13
const CHUNK_OVERHEAD = 12

const getChunk = (type: string, data: Uint8Array): Buffer => {
  const chunk = Buffer.alloc(CHUNK_OVERHEAD + data.length)
  chunk.writeUInt32BE(data.length, 0)
  chunk.write(type, 4, 'latin1')
  chunk.set(data, 8)
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length)
  return chunk
}

const getHeaderData = (image: RgbaImage): Buffer => {
  const header = Buffer.alloc(HEADER_LENGTH)
  header.writeUInt32BE(image.width, 0)
  header.writeUInt32BE(image.height, 4)
  header[8] = BIT_DEPTH
  header[9] = COLOR_TYPE_RGBA
  return header
}

// Every row gets filter type 0 (none).
const getFilteredRows = (image: RgbaImage): Buffer => {
  const rowBytes = image.width * BYTES_PER_PIXEL
  const filtered = Buffer.alloc((rowBytes + 1) * image.height)
  for (let row = 0; row < image.height; row++) {
    filtered.set(
      image.colors.subarray(row * rowBytes, (row + 1) * rowBytes),
      row * (rowBytes + 1) + 1
    )
  }
  return filtered
}

export const encodePng = (image: RgbaImage): Uint8Array =>
  Buffer.concat([
    SIGNATURE,
    getChunk('IHDR', getHeaderData(image)),
    getChunk('IDAT', deflateSync(getFilteredRows(image))),
    getChunk('IEND', new Uint8Array()),
  ])

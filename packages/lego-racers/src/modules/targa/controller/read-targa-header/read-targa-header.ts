import {
  InvalidTargaError,
  UnsupportedTargaDepthError,
} from '../../types/targa-errors/targa-errors.ts'
import type { TargaHeader } from '../../types/targa.types.ts'

const HEADER_LENGTH = 0x12
const PALETTE_ENTRY_COUNT = 0x100
const PALETTE_BYTES = PALETTE_ENTRY_COUNT * 4
const MAXIMUM_PALETTE_DEPTH = 8
const SUPPORTED_DEPTHS: readonly number[] = [4, 8, 16, 24, 32]

const OPAQUE = 0xff

const getUnsignedShort = (file: Uint8Array, offset: number): number =>
  (file[offset] ?? 0) | ((file[offset + 1] ?? 0) << 8)

// A 15 or 16 bit colour map entry (0x1002a65b): five bits per channel from bit 10 down; the 16-bit form leaves
// alpha 0 where the 15-bit form sets 0xff.
const getPackedEntry = (value: number, alpha: number): readonly number[] => [
  (value >> 7) & 0xf8,
  (value >> 2) & 0xf8,
  (value << 3) & 0xff,
  alpha,
]

const getPaletteEntry = (
  file: Uint8Array,
  start: number,
  entryBits: number
): readonly number[] | null => {
  const [first = 0, second = 0, third = 0, fourth = 0] = file.subarray(start, start + 4)
  switch (entryBits) {
    case 15:
      return getPackedEntry(first | (second << 8), OPAQUE)
    case 16:
      return getPackedEntry(first | (second << 8), 0)
    case 24:
      return [third, second, first, OPAQUE]
    case 32:
      return [third, second, first, fourth]
    default:
      return null
  }
}

// The colour map as 0x1002a5e0 keeps it: R, G, B, A per entry, at most 256 entries; an entry size it has no case
// for leaves the entries zero.
const readPalette = (
  file: Uint8Array,
  start: number,
  length: number,
  entryBits: number
): Uint8Array => {
  const palette = new Uint8Array(PALETTE_BYTES)
  const entrySize = (entryBits + 7) >> 3
  for (let index = 0; index < Math.min(length, PALETTE_ENTRY_COUNT); index++) {
    const entry = getPaletteEntry(file, start + index * entrySize, entryBits)
    if (entry !== null) palette.set(entry, index * 4)
  }
  return palette
}

// GolDP.dll 0x1002a5e0 (Targa vtable 0x10057578 slot 0): the 18 header bytes, then the colour map of a
// palettised image. The origin bytes and the descriptor are stored and never used again.
export const readTargaHeader = (file: Uint8Array): TargaHeader => {
  if (file.length < HEADER_LENGTH) throw new InvalidTargaError('Unable to read the Targa header')
  const identifierLength = file[0] ?? 0
  const colorMapType = file[1] ?? 0
  const colorMapLength = getUnsignedShort(file, 5)
  const colorMapEntryBits = file[7] ?? 0
  const width = getUnsignedShort(file, 12)
  const bitsPerPixel = file[16] ?? 0
  const isPalettised = colorMapType !== 0 && bitsPerPixel <= MAXIMUM_PALETTE_DEPTH
  const mapStart = identifierLength + HEADER_LENGTH
  if (!SUPPORTED_DEPTHS.includes(bitsPerPixel)) throw new UnsupportedTargaDepthError(bitsPerPixel)
  return Object.freeze({
    identifierLength,
    colorMapType,
    imageType: file[2] ?? 0,
    colorMapOrigin: getUnsignedShort(file, 3),
    colorMapLength,
    colorMapEntryBits,
    originX: getUnsignedShort(file, 8),
    originY: getUnsignedShort(file, 10),
    width,
    height: getUnsignedShort(file, 14),
    bitsPerPixel,
    descriptor: file[17] ?? 0,
    stride: ((width * bitsPerPixel + 0x1f) >> 3) & ~3,
    pixelDataOffset: isPalettised
      ? mapStart + ((colorMapEntryBits + 7) >> 3) * colorMapLength
      : mapStart,
    paletteCount: isPalettised ? Math.min(colorMapLength, PALETTE_ENTRY_COUNT) : 0,
    palette: isPalettised
      ? readPalette(file, mapStart, colorMapLength, colorMapEntryBits)
      : new Uint8Array(PALETTE_BYTES),
  })
}

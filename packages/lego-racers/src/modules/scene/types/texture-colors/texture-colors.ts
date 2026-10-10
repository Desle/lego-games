import type { ColorKey, KeyedBitmap } from './texture-colors.types.ts'

const PALETTE_ENTRY_SIZE = 4
const MAXIMUM_PALETTE_BITS = 8

// GolDP.dll 0x100200f0: the first of the 2^bitsPerPixel palette entries whose R, G, B equal the key gets
// alpha 0 when the texture is uploaded; -1 when none matches or the bitmap has no palette.
export const getColorKeyPaletteIndex = (bitmap: KeyedBitmap, colorKey: ColorKey): number => {
  if (bitmap.bitsPerPixel > MAXIMUM_PALETTE_BITS) return -1
  const entryCount = 1 << bitmap.bitsPerPixel
  for (let index = 0; index < entryCount; index++) {
    const start = index * PALETTE_ENTRY_SIZE
    if (
      bitmap.palette[start] === colorKey[0] &&
      bitmap.palette[start + 1] === colorKey[1] &&
      bitmap.palette[start + 2] === colorKey[2]
    ) {
      return index
    }
  }
  return -1
}

// The palette with the keyed entry made transparent.
export const getKeyedPalette = (bitmap: KeyedBitmap, colorKey: ColorKey): Uint8Array => {
  const palette = bitmap.palette.slice()
  const keyIndex = getColorKeyPaletteIndex(bitmap, colorKey)
  if (keyIndex >= 0) palette[keyIndex * PALETTE_ENTRY_SIZE + 3] = 0
  return palette
}

// GolDP.dll 0x100204d0 sets up the same key for true-colour bitmaps: matching pixels get alpha 0.
export const getKeyedTrueColors = (colors: Uint8Array, colorKey: ColorKey): Uint8Array => {
  const keyed = colors.slice()
  for (let start = 0; start < keyed.length; start += PALETTE_ENTRY_SIZE) {
    if (
      keyed[start] === colorKey[0] &&
      keyed[start + 1] === colorKey[1] &&
      keyed[start + 2] === colorKey[2]
    ) {
      keyed[start + 3] = 0
    }
  }
  return keyed
}

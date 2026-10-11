import { getBitmapColors } from '../../../bitmap/index.ts'
import type { Bitmap } from '../../../bitmap/index.ts'
import type { FontColorKey } from '../../types/font-rendering.types.ts'

// Texture flag 0x20 (GolDP.dll 0x100200f0): the first palette entry equal to the key colour gets alpha 0.
const getTransparentPaletteIndex = (bitmap: Bitmap, colorKey: FontColorKey): number => {
  const entryCount = 1 << bitmap.bitsPerPixel
  for (let index = 0; index < entryCount; index++) {
    const start = index * 4
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

const getPaletteIndex = (bitmap: Bitmap, column: number, row: number): number => {
  const rowStart = row * bitmap.stride
  if (bitmap.bitsPerPixel === 4) {
    const packed = bitmap.pixels[rowStart + (column >> 1)] ?? 0
    return column % 2 === 0 ? packed >> 4 : packed & 0xf
  }
  return bitmap.pixels[rowStart + column] ?? 0
}

// The font image as RGBA bytes, rows top to bottom, with the colour key made transparent.
export const getFontImagePixels = (bitmap: Bitmap, colorKey: FontColorKey | null): Uint8Array => {
  const colors = getBitmapColors(bitmap)
  if (colorKey === null) return colors
  if (bitmap.bitsPerPixel > 8) {
    for (let start = 0; start < colors.length; start += 4) {
      if (
        colors[start] === colorKey[0] &&
        colors[start + 1] === colorKey[1] &&
        colors[start + 2] === colorKey[2]
      ) {
        colors[start + 3] = 0
      }
    }
    return colors
  }
  const transparentIndex = getTransparentPaletteIndex(bitmap, colorKey)
  for (let row = 0; row < bitmap.height; row++) {
    for (let column = 0; column < bitmap.width; column++) {
      if (getPaletteIndex(bitmap, column, row) === transparentIndex) {
        colors[(row * bitmap.width + column) * 4 + 3] = 0
      }
    }
  }
  return colors
}

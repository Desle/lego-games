import { getBitmapColors } from '../../../bitmap/index.ts'
import type { Bitmap } from '../../../bitmap/index.ts'
import { getColorKeyPaletteIndex } from '../../../scene/index.ts'
import type { FontColorKey } from '../../types/font-rendering.types.ts'

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
  const transparentIndex = getColorKeyPaletteIndex(bitmap, colorKey)
  for (let row = 0; row < bitmap.height; row++) {
    for (let column = 0; column < bitmap.width; column++) {
      if (getPaletteIndex(bitmap, column, row) === transparentIndex) {
        colors[(row * bitmap.width + column) * 4 + 3] = 0
      }
    }
  }
  return colors
}

import type { Bitmap } from '../bitmap.types.ts'

const getPixelColorStart = (bitmap: Bitmap, row: number, column: number): number => {
  const rowStart = row * bitmap.stride
  switch (bitmap.bitsPerPixel) {
    case 4: {
      const packed = bitmap.pixels[rowStart + (column >> 1)] ?? 0
      return (column % 2 === 0 ? packed >> 4 : packed & 0xf) * 4
    }
    case 8:
      return (bitmap.pixels[rowStart + column] ?? 0) * 4
    default:
      return -1
  }
}

// Expands to RGBA, rows top to bottom. Transparency comes from materials, not from the bitmap.
export const getBitmapColors = (bitmap: Bitmap): Uint8Array => {
  const colors = new Uint8Array(bitmap.width * bitmap.height * 4)
  const bytesPerPixel = bitmap.bitsPerPixel >> 3
  for (let row = 0; row < bitmap.height; row++) {
    for (let column = 0; column < bitmap.width; column++) {
      const target = (row * bitmap.width + column) * 4
      const paletteStart = getPixelColorStart(bitmap, row, column)
      if (paletteStart >= 0) {
        colors.set(bitmap.palette.subarray(paletteStart, paletteStart + 4), target)
        continue
      }
      const source = row * bitmap.stride + column * bytesPerPixel
      const alpha = bytesPerPixel === 4 ? (bitmap.pixels[source + 3] ?? 0) : 0xff
      colors.set(
        [
          bitmap.pixels[source + 2] ?? 0,
          bitmap.pixels[source + 1] ?? 0,
          bitmap.pixels[source] ?? 0,
          alpha,
        ],
        target
      )
    }
  }
  return colors
}

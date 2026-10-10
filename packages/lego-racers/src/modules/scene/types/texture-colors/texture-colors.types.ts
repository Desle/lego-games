// The decoded-bitmap fields the colour key needs (bitmap module's Bitmap), restated so this layer imports nothing.
export type KeyedBitmap = {
  readonly width: number
  readonly height: number
  readonly bitsPerPixel: number
  readonly palette: Uint8Array
}

export type ColorKey = readonly [number, number, number]

export type WindowsBitmapHeader = {
  readonly width: number
  readonly height: number
  readonly isTopDown: boolean
  readonly bitsPerPixel: number
  readonly paletteOffset: number
  readonly paletteColorCount: number
  readonly pixelDataOffset: number
}

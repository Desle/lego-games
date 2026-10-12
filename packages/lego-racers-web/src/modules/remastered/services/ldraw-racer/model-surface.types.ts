import type { SceneBitmap } from '@lego-games/lego-racers/scene'

export type BatchSurface = {
  readonly materialName: string
  readonly bitmapPath: string
  readonly bitmap: SceneBitmap | null
  readonly diffuseColor: readonly number[]
}

// A part of a bitmap by fractions of its width and height (0 to 1, rows top to bottom).
export type BitmapRegion = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

// A colour of a bitmap (0xRRGGBB, the average of its quantization bin) and the share of the opaque pixels it covers.
export type ColorShare = {
  readonly color: number
  readonly share: number
}

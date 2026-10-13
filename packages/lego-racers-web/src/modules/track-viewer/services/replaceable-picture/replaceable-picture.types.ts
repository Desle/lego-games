// A picture as it is drawn now: the original's, or a replacement of any size whose pixels cover the same design area.
export type PictureState = {
  readonly name: string
  readonly width: number
  readonly height: number
  // RGBA, rows top to bottom.
  readonly colors: Uint8Array
  // Picture pixels per original pixel (1 for the original's own); source rectangles in original pixels are multiplied by it.
  readonly sourceScale: number
}

export type ReplaceablePicture = {
  readonly getState: () => PictureState
}

export type ReplaceablePictureOriginal = {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly colors: Uint8Array
}

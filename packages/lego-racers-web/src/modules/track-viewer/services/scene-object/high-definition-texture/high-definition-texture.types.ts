export type TexturePixels = {
  readonly colors: Uint8Array
  readonly width: number
  readonly height: number
}

export type StageSize = {
  readonly width: number
  readonly height: number
}

export type WindowMetrics = {
  readonly innerWidth: number
  readonly innerHeight: number
  readonly devicePixelRatio: number
}

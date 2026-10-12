// The six numbers of a canvas transform: x' = xFromX x + xFromY y + xOffset, y' = yFromX x + yFromY y + yOffset.
export type TextureTransform = {
  readonly xFromX: number
  readonly yFromX: number
  readonly xFromY: number
  readonly yFromY: number
  readonly xOffset: number
  readonly yOffset: number
}

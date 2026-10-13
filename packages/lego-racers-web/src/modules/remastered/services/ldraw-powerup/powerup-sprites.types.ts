// A power-up sprite: its material (from the material library and texture database `library` in `directory`) and its size in the
// race's units.
export type PowerUpSprite = {
  readonly materialName: string
  readonly directory: string
  readonly library: string
  readonly width: number
  readonly height: number
}

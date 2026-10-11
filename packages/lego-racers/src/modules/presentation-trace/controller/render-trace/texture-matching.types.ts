// The port textures that look like one of the original's surfaces.
export type TextureMatch = {
  // The closest port texture, or null when none is near enough.
  readonly bestKey: string | null
  // The mean difference per channel (0..255) to the closest.
  readonly difference: number
  // Every texture within the colour quantisation of the closest: pictures that look the same.
  readonly acceptableKeys: readonly string[]
}

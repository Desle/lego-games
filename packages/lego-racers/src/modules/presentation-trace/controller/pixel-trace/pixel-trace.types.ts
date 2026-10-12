// A picture of RGBA bytes, top row first.
export type PixelImage = {
  readonly width: number
  readonly height: number
  readonly colors: Uint8ClampedArray
}

// A texture surface of the original as RGBA bytes.
export type DecodedTexture = PixelImage & {
  // 1 for the texels equal to the surface's colour key; null when the surface has none.
  readonly keyedTexels: Uint8Array | null
}

// The original's frame drawn by the software rasteriser: the colours and, per pixel, which draw and texture put them there.
export type RasterisedFrame = PixelImage & {
  // Index into `textureHashes` of the texture of the draw that wrote the pixel last; -1 for no texture or no write.
  readonly textureIndices: Int16Array
  readonly textureHashes: readonly string[]
}

export type RasteriseOptions = {
  readonly width: number
  readonly height: number
  // The HUD (the draws after the last depth-tested draw) is left out: the viewer draws it as page elements, not pixels.
  readonly isHudIncluded: boolean
  // The colour the frame is cleared to (red, green, blue).
  readonly clearColor: readonly [number, number, number]
}

export type PixelTolerance = {
  // The largest difference of any colour channel (0..255) that still counts as the same colour.
  readonly channelLevels: number
}

export type PixelRegion = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly differingCount: number
  // The original textures under the differing pixels of the region, most pixels first.
  readonly dominantTextures: readonly { readonly label: string; readonly count: number }[]
  // The mean colour (red, green, blue) of the region's differing pixels in the original and in the port.
  readonly meanReference: readonly [number, number, number]
  readonly meanPort: readonly [number, number, number]
}

export type TextureCoverage = {
  readonly label: string
  // Pixels whose last writer in the original used the texture, and how many of them differ in the port.
  readonly pixelCount: number
  readonly differingCount: number
}

export type PixelComparison = {
  readonly pixelCount: number
  readonly differingCount: number
  readonly differingShare: number
  readonly regions: readonly PixelRegion[]
  readonly textureCoverages: readonly TextureCoverage[]
}

export type PixelComparisonInput = {
  readonly reference: RasterisedFrame
  readonly port: PixelImage
  readonly tolerance: PixelTolerance
  // A readable name per original texture hash (the port's matching texture); the hash itself when unknown.
  readonly textureLabels: ReadonlyMap<string, string>
  // The regions listed, largest first.
  readonly maximumRegionCount: number
}

export type MaterialColor = readonly [number, number, number, number]

// The definition GolDP.dll 0x10026270 builds on its stack and hands to 0x100257e0.
export type Material = {
  readonly name: string
  readonly flags: number
  // Looked up in the texture library when the engine loads the file; null when the material has none.
  readonly textureName: string | null
  readonly ambientColor: MaterialColor
  readonly diffuseColor: MaterialColor
  // Index 0..7 into 0x10056540 (D3DCMP values).
  readonly alphaFunction: number
  readonly alphaReference: number
  // Indices 0..10 into the blend tables at renderer +0xc8708 and +0xc8734.
  readonly sourceBlend: number
  // Read as the destination blend index with flag 0x100, as the constant opacity with flag 0x1000.
  readonly destinationBlendOrOpacity: number
}

export type MaterialLibrary = {
  readonly materials: readonly Material[]
  readonly readByteCount: number
}

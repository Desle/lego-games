// The fields of a material definition (GolDP.dll 0x10026270) and its texture that 0x1000a2c0 reads.
export type RenderStateInput = {
  readonly flags: number
  readonly alphaFunction: number
  readonly alphaReference: number
  readonly sourceBlend: number
  readonly destinationBlendOrOpacity: number
  // Flags of the material's texture (TDB `+0x36`), or null without a texture.
  readonly textureFlags: number | null
}

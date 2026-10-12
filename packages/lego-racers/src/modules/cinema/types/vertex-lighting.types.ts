export type LightChannels = readonly [number, number, number]

// A directional light as the device holds it: the colour bytes and the direction the light travels, in the frame of the
// model being drawn.
export type VertexLight = {
  readonly color: LightChannels
  readonly direction: LightChannels
}

export type VertexLightingInput = {
  // The device's ambient light bytes (+0xc856c).
  readonly ambient: LightChannels
  readonly materialAmbient: LightChannels
  readonly materialDiffuse: LightChannels
  readonly lights: readonly VertexLight[]
  readonly normal: LightChannels
}

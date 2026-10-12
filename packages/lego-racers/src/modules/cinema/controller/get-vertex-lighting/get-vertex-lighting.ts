import type { LightChannels, VertexLightingInput } from '../../types/vertex-lighting.types.ts'

const AMBIENT_SHIFT = 8
const LIGHT_SCALE = 1 / 256
const MAXIMUM_CHANNEL = 255

const getDot = (left: LightChannels, right: LightChannels): number =>
  left[2] * right[2] + left[1] * right[1] + left[0] * right[0]

const getChannel = (input: VertexLightingInput, channel: 0 | 1 | 2): number => {
  const ambient = (input.ambient[channel] * input.materialAmbient[channel]) >> AMBIENT_SHIFT
  const lit = input.lights.reduce((value, light) => {
    const lightChannel =
      Math.fround(light.color[channel] * input.materialDiffuse[channel]) * LIGHT_SCALE
    return value - Math.trunc(getDot(input.normal, light.direction) * lightChannel)
  }, ambient)
  return Math.min(MAXIMUM_CHANNEL, Math.max(ambient, lit))
}

// GolDP.dll 0x1000a2c0 and the light function 0x10011ed0 (one light): the ambient of a channel is the device's ambient byte
// times the material's ambient byte, shifted right by 8; a light's channel is its colour byte times the material's diffuse
// byte over 256; a vertex's channel is the ambient minus the truncated dot of its normal and the light's direction times the
// light's channel, kept between the ambient and 255. (More than one light subtract in turn, hypothesis: only one is used.)
export const getLitVertexColor = (input: VertexLightingInput): LightChannels => [
  getChannel(input, 0),
  getChannel(input, 1),
  getChannel(input, 2),
]

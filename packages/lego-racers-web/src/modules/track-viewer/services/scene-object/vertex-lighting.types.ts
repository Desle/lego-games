import type { LightChannels, VertexLight } from '@lego-games/lego-racers/cinema'

// The material bytes a batch needs to be lit again when the lights change.
export type LitMaterial = {
  readonly ambient: LightChannels
  readonly diffuse: LightChannels
}

// What the device holds: the ambient light bytes and the directional lights (colour bytes, the direction they travel in the
// world).
export type SceneLights = {
  readonly ambient: LightChannels
  readonly directional: readonly VertexLight[]
}

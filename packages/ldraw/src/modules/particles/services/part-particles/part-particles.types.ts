import type { Box3, Group, Matrix4 } from 'three'

// A model's text (one part in one colour: `getParticlePartText`), drawn up to `maxCount` times a frame, faded out closer to the
// camera than `nearFadeDistance` (the drawing's units; 0 never fades).
export type PartParticlesSettings = {
  readonly modelText: string
  readonly maxCount: number
  readonly nearFadeDistance: number
}

// A particle being written: where its part is (a matrix from the part's LDraw frame into the drawing's), and how opaque it is.
export type PartParticleSlot = {
  readonly setMatrix: (matrix: Matrix4) => void
  readonly setOpacity: (opacity: number) => void
}

export type PartParticleWriter = (index: number, slot: PartParticleSlot) => void

// A part drawn as many particles in one draw call per material of the part: the app writes every particle of a frame at once.
export type PartParticles = {
  readonly object: Group
  // Resolves when the part is drawable; particles written before then are not drawn.
  readonly shown: Promise<void>
  // The model's bounds in its own LDraw frame once it is shown, null before.
  readonly getModelBounds: () => Box3 | null
  // Draws `count` particles (at most `maxCount`), each written by `writeParticle`; 0 draws nothing.
  readonly setParticles: (count: number, writeParticle: PartParticleWriter) => void
  readonly dispose: () => void
}

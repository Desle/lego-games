import type { Group, Matrix4 } from 'three'

// One part in one colour, drawn up to `maxCount` times a frame.
export type PartParticlesSettings = {
  readonly partName: string
  readonly colorCode: number
  readonly maxCount: number
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
  // Draws `count` particles (at most `maxCount`), each written by `writeParticle`; 0 draws nothing.
  readonly setParticles: (count: number, writeParticle: PartParticleWriter) => void
  readonly dispose: () => void
}

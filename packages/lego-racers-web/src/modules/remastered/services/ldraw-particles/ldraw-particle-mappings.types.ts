import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// The kinds of small particle the races draw, one LDraw part and colour each: the materials of a kind share one drawing.
export const LDrawParticleKind = createEnum({
  SMOKE: 'smoke',
  WHITE_SMOKE: 'white_smoke',
  DARK_SMOKE: 'dark_smoke',
  DUST: 'dust',
  SAND: 'sand',
  SPARKS: 'sparks',
  HOT_SPARKS: 'hot_sparks',
  WATER: 'water',
  GRASS: 'grass',
  SWAMP: 'swamp',
  SNOW: 'snow',
})
export type LDrawParticleKind = EnumValues<typeof LDrawParticleKind>

export type LDrawParticlePart = {
  readonly partName: string
  readonly colorCode: number
}

// A particle material of the original's: its kind, and the alpha (of the material's opacity) at which its part is drawn solid;
// a lower alpha fades the part by the same share.
export type LDrawParticleMaterial = {
  readonly kind: LDrawParticleKind
  readonly solidAlpha: number
}

// What the builder shows a kind against: a material of its first row (its picture and colour, from the material library and
// texture database of the same stem in the same folder) on a card the size of an emitter's quad that draws the kind (its first
// size, or its last when the quad starts at nothing).
export type LDrawParticleReference = {
  readonly directory: string
  readonly library: string
  readonly materialName: string
  readonly emitterPath: string
  readonly emitterName: string
}

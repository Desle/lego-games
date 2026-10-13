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

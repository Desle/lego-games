import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const LookPreset = createEnum({
  MANUAL: 'manual',
  PHOTO: 'photo',
  INSTRUCTIONS: 'instructions',
  TOON: 'toon',
  GAME: 'game',
  RETRO: 'retro',
})
export type LookPreset = EnumValues<typeof LookPreset>

// How the light falls on the plastic: three.js's physical plastic, or one of the stylised models that replace its lighting.
export const LookShading = createEnum({
  PLASTIC: 'plastic',
  INSTRUCTIONS: 'instructions',
  TOON: 'toon',
  GAME: 'game',
  RETRO: 'retro',
})
export type LookShading = EnumValues<typeof LookShading>

// What becomes of the LDraw edge lines: dimmed and darkened, pale additive catch-lights, drawn in the library's edge colour,
// solid black ink, or not drawn.
export const LookEdges = createEnum({
  DIMMED: 'dimmed',
  CATCH_LIGHT: 'catch_light',
  LIBRARY: 'library',
  INK: 'ink',
  HIDDEN: 'hidden',
})
export type LookEdges = EnumValues<typeof LookEdges>

// What a part is made of, from the library's colour finish (and a tyre from its part): each takes its own surface in every look.
export const MaterialCategory = createEnum({
  PLASTIC: 'plastic',
  RUBBER: 'rubber',
  TRANSPARENT: 'transparent',
  CHROME: 'chrome',
  METALLIC: 'metallic',
})
export type MaterialCategory = EnumValues<typeof MaterialCategory>

// What a look does to the LDraw plastic and its studio. Numbers of 0 switch a feature off.
export type LookAppearance = {
  readonly label: string
  readonly shading: LookShading
  readonly edges: LookEdges
  readonly roughness: number
  readonly clearcoat: number
  readonly clearcoatRoughness: number
  readonly environmentIntensity: number
  // A dim room with bright strip lights instead of the bright small studio: contrast for a glossy clear coat.
  readonly isEnvironmentStudio: boolean
  readonly catchLightOpacity: number
  readonly occlusionStrength: number
  readonly roughnessVariation: number
  // 1 keeps the library's colours; below 1 washes them toward grey, above 1 saturates them.
  readonly saturation: number
  // Filmic tone mapping and sRGB output on the plastic only (the track is prelit and keeps the original's output).
  readonly isGraded: boolean
  readonly exposure: number
  readonly contrast: number
  readonly keyColor: number
  readonly keyIntensity: number
  readonly fillIntensity: number
  readonly rimIntensity: number
  readonly hemisphereIntensity: number
  readonly ambientIntensity: number
}

import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const LookPreset = createEnum({
  MANUAL: 'manual',
  STUDIO: 'studio',
  PHOTO: 'photo',
  MOVIE: 'movie',
})
export type LookPreset = EnumValues<typeof LookPreset>

// What a look does to the LDraw plastic and its studio. Numbers of 0 switch a feature off.
export type LookAppearance = {
  readonly label: string
  readonly roughness: number
  readonly clearcoat: number
  readonly clearcoatRoughness: number
  readonly environmentIntensity: number
  readonly isEnvironmentStudio: boolean
  readonly isEdgeVisible: boolean
  // Edge lines drawn as additive catch-lights of this opacity instead of black outlines (0: none).
  readonly catchLightOpacity: number
  readonly occlusionStrength: number
  readonly roughnessVariation: number
  readonly wear: number
  // Filmic tone mapping and sRGB output on the plastic only (the track is prelit and keeps the original's output).
  readonly isGraded: boolean
  readonly exposure: number
  readonly warmth: number
  readonly saturation: number
  readonly contrast: number
  readonly keyColor: number
  readonly keyIntensity: number
  readonly fillIntensity: number
  readonly rimIntensity: number
  readonly hemisphereIntensity: number
  readonly ambientIntensity: number
}

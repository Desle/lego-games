import { PLASTIC_APPEARANCE } from './ldraw-plastic.constants.ts'
import { LookPreset } from './ldraw-look.types.ts'
import type { LookAppearance } from './ldraw-look.types.ts'

export const LOOK_PARAMETER = 'look'
const DEFAULT_LOOK = LookPreset.PHOTO

const MANUAL_LOOK: LookAppearance = Object.freeze({
  label: 'Manual',
  roughness: PLASTIC_APPEARANCE.roughness,
  clearcoat: PLASTIC_APPEARANCE.clearcoat,
  clearcoatRoughness: PLASTIC_APPEARANCE.clearcoatRoughness,
  environmentIntensity: PLASTIC_APPEARANCE.environmentIntensity,
  isEnvironmentStudio: false,
  isEdgeVisible: true,
  catchLightOpacity: 0,
  occlusionStrength: 0,
  roughnessVariation: 0,
  wear: 0,
  isGraded: false,
  exposure: 1,
  warmth: 0,
  saturation: 1,
  contrast: 0,
  keyColor: 0xfff4e6,
  keyIntensity: PLASTIC_APPEARANCE.keyIntensity,
  fillIntensity: PLASTIC_APPEARANCE.fillIntensity,
  rimIntensity: PLASTIC_APPEARANCE.rimIntensity,
  hemisphereIntensity: PLASTIC_APPEARANCE.hemisphereIntensity,
  ambientIntensity: PLASTIC_APPEARANCE.ambientIntensity,
})

const STUDIO_LOOK: LookAppearance = Object.freeze({
  ...MANUAL_LOOK,
  label: 'Studio',
  roughness: 0.2,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  environmentIntensity: 2.6,
  isEnvironmentStudio: true,
  isEdgeVisible: false,
})

// Graded looks are lit in linear light and encoded once at the end, so their lights are lower than the manual's.
const PHOTO_LOOK: LookAppearance = Object.freeze({
  ...STUDIO_LOOK,
  label: 'Photo',
  catchLightOpacity: 0.32,
  occlusionStrength: 0.7,
  roughnessVariation: 0.05,
  isGraded: true,
  exposure: 0.62,
  saturation: 1.04,
  contrast: 0.12,
  keyIntensity: 2.2,
  fillIntensity: 0.4,
  rimIntensity: 0.7,
  hemisphereIntensity: 0.6,
  ambientIntensity: 0.1,
})

const MOVIE_LOOK: LookAppearance = Object.freeze({
  ...PHOTO_LOOK,
  label: 'LEGO Movie',
  roughnessVariation: 0.12,
  wear: 1,
  exposure: 0.66,
  warmth: 0.09,
  saturation: 1.1,
  contrast: 0.2,
  keyColor: 0xffe2bd,
  keyIntensity: 1.7,
  fillIntensity: 0.55,
  hemisphereIntensity: 0.85,
  ambientIntensity: 0.16,
})

export const LOOK_APPEARANCES: Readonly<Record<LookPreset, LookAppearance>> = Object.freeze({
  [LookPreset.MANUAL]: MANUAL_LOOK,
  [LookPreset.STUDIO]: STUDIO_LOOK,
  [LookPreset.PHOTO]: PHOTO_LOOK,
  [LookPreset.MOVIE]: MOVIE_LOOK,
})

const PRESETS: readonly LookPreset[] = Object.values(LookPreset)

// `?look=manual|studio|photo|movie`; the default is the photo look.
export const getLookPreset = (search: string): LookPreset => {
  const requested = new URLSearchParams(search).get(LOOK_PARAMETER)
  return PRESETS.find((preset) => preset === requested) ?? DEFAULT_LOOK
}

export const getLookLabels = (): readonly string[] =>
  PRESETS.map((preset) => LOOK_APPEARANCES[preset].label)

export const getLookPresetFromLabel = (label: string | null): LookPreset =>
  PRESETS.find((preset) => LOOK_APPEARANCES[preset].label === label) ?? DEFAULT_LOOK

let activePreset: LookPreset = DEFAULT_LOOK

// The look the LDraw drawings made from now on take (set once by the registration, or by a gallery page).
export const setActiveLookPreset = (preset: LookPreset) => {
  activePreset = preset
}

export const getActiveLook = (): LookAppearance => LOOK_APPEARANCES[activePreset]

// For the pages that draw without the registration (the galleries): the look the address asks for.
export const useLookFromAddress = () =>
  setActiveLookPreset(getLookPreset(globalThis.location.search))

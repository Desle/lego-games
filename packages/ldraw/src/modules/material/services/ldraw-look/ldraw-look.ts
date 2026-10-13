import { PLASTIC_APPEARANCE } from '../ldraw-plastic/ldraw-plastic.constants.ts'
import { LookEdges, LookPreset, LookShading } from './ldraw-look.types.ts'
import type { LookAppearance } from './ldraw-look.types.ts'

export const LOOK_PARAMETER = 'look'
// The user prefers the manual look; it stays the default.
const DEFAULT_LOOK = LookPreset.MANUAL

const MANUAL_LOOK: LookAppearance = Object.freeze({
  label: 'Manual',
  shading: LookShading.PLASTIC,
  edges: LookEdges.DIMMED,
  roughness: PLASTIC_APPEARANCE.roughness,
  clearcoat: PLASTIC_APPEARANCE.clearcoat,
  clearcoatRoughness: PLASTIC_APPEARANCE.clearcoatRoughness,
  environmentIntensity: PLASTIC_APPEARANCE.environmentIntensity,
  isEnvironmentStudio: false,
  catchLightOpacity: 0,
  occlusionStrength: 0,
  roughnessVariation: 0,
  saturation: 1,
  isGraded: false,
  exposure: 1,
  contrast: 0,
  keyColor: 0xfff4e6,
  keyIntensity: PLASTIC_APPEARANCE.keyIntensity,
  fillIntensity: PLASTIC_APPEARANCE.fillIntensity,
  rimIntensity: PLASTIC_APPEARANCE.rimIntensity,
  hemisphereIntensity: PLASTIC_APPEARANCE.hemisphereIntensity,
  ambientIntensity: PLASTIC_APPEARANCE.ambientIntensity,
})

// A product photograph: a clear coat over glossy plastic in a dim studio with strip lights, baked ambient occlusion, the edge lines
// as pale catch-lights, and a filmic grade. Graded looks are lit in linear light and encoded once at the end, so their lights are
// lower than the manual's.
const PHOTO_LOOK: LookAppearance = Object.freeze({
  ...MANUAL_LOOK,
  label: 'Photo',
  edges: LookEdges.CATCH_LIGHT,
  roughness: 0.2,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  environmentIntensity: 2.6,
  isEnvironmentStudio: true,
  catchLightOpacity: 0.32,
  occlusionStrength: 0.7,
  roughnessVariation: 0.05,
  saturation: 1.04,
  isGraded: true,
  exposure: 0.62,
  contrast: 0.12,
  keyIntensity: 2.2,
  fillIntensity: 0.4,
  rimIntensity: 0.7,
  hemisphereIntensity: 0.6,
  ambientIntensity: 0.1,
})

// The stylised looks light the plastic themselves: no clear coat and no reflected studio.
const STYLISED_LOOK: LookAppearance = Object.freeze({
  ...MANUAL_LOOK,
  roughness: 1,
  clearcoat: 0,
  environmentIntensity: 0,
})

// A modern LEGO building-instructions page: nearly flat colour, no highlight, every edge drawn in the library's edge colour.
const INSTRUCTIONS_LOOK: LookAppearance = Object.freeze({
  ...STYLISED_LOOK,
  label: 'Instructions',
  shading: LookShading.INSTRUCTIONS,
  edges: LookEdges.LIBRARY,
})

// Cel shading: three hard bands, a hard highlight and black ink lines.
const TOON_LOOK: LookAppearance = Object.freeze({
  ...STYLISED_LOOK,
  label: 'Toon',
  shading: LookShading.TOON,
  edges: LookEdges.INK,
  saturation: 1.1,
})

// The LEGO video games: saturated, soft wrapped light, a broad highlight, soft occlusion and a thin rim along the silhouette.
const GAME_LOOK: LookAppearance = Object.freeze({
  ...STYLISED_LOOK,
  label: 'Game',
  shading: LookShading.GAME,
  edges: LookEdges.HIDDEN,
  occlusionStrength: 0.6,
  saturation: 1.3,
})

// The 1999 game itself: faceted, one light and ambient, no highlight, 16-bit colour with a dither.
const RETRO_LOOK: LookAppearance = Object.freeze({
  ...STYLISED_LOOK,
  label: 'Retro 1999',
  shading: LookShading.RETRO,
  edges: LookEdges.HIDDEN,
})

export const LOOK_APPEARANCES: Readonly<Record<LookPreset, LookAppearance>> = Object.freeze({
  [LookPreset.MANUAL]: MANUAL_LOOK,
  [LookPreset.PHOTO]: PHOTO_LOOK,
  [LookPreset.INSTRUCTIONS]: INSTRUCTIONS_LOOK,
  [LookPreset.TOON]: TOON_LOOK,
  [LookPreset.GAME]: GAME_LOOK,
  [LookPreset.RETRO]: RETRO_LOOK,
})

const PRESETS: readonly LookPreset[] = Object.values(LookPreset)

// `?look=manual|photo|instructions|toon|game|retro`; the default is the manual look.
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

// The stylised looks encode their own output, so the library's colours already reach the screen as it names them.
export const getIsLookEncoded = (): boolean => getActiveLook().shading !== LookShading.PLASTIC

// For the pages that draw without the registration (the galleries): the look the address asks for.
export const useLookFromAddress = () =>
  setActiveLookPreset(getLookPreset(globalThis.location.search))

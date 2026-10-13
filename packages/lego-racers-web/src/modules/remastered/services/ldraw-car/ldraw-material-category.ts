import type { MeshStandardMaterial } from 'three'
import { LookShading, MaterialCategory } from './ldraw-look.types.ts'
import type { LookAppearance } from './ldraw-look.types.ts'
import type { MaterialSurface } from './ldraw-material-category.types.ts'

// The library's finishes as three.js's LDraw loader makes them: chrome is metalness 1, metal 0.85, matte metallic 0.4 (pearlescent
// 0.25 stays plastic), rubber roughness 0.9; plain colours are roughness 0.3.
const CHROME_METALNESS = 0.95
const METALLIC_METALNESS = 0.4
const RUBBER_ROUGHNESS = 0.85

// Rubber is matte: no clear coat, a little of the studio.
const RUBBER_SURFACE_ROUGHNESS = 0.92
const RUBBER_ENVIRONMENT_SHARE = 0.3
// A wheel's thin spokes face the studio at every angle as it turns: its plastic reflects less of it.
const WHEEL_ENVIRONMENT_SHARE = 0.35

// Tyres are drawn in the library's rubber colours (`Rubber_Black`), so they are rubber by their finish.
export const getMaterialCategory = (source: MeshStandardMaterial): MaterialCategory => {
  if (source.transparent) return MaterialCategory.TRANSPARENT
  if (source.metalness >= CHROME_METALNESS) return MaterialCategory.CHROME
  if (source.metalness >= METALLIC_METALNESS) return MaterialCategory.METALLIC
  if (source.roughness >= RUBBER_ROUGHNESS) return MaterialCategory.RUBBER
  return MaterialCategory.PLASTIC
}

// The stylised looks light every material alike (rubber only loses its highlight); the physical looks give chrome and metal the
// library's own finish, rubber a matte one, and plastic (clear or not) the look's clear-coated plastic.
export const getMaterialSurface = (
  category: MaterialCategory,
  source: MeshStandardMaterial,
  look: LookAppearance,
  isWheel = false
): MaterialSurface => {
  const plastic: MaterialSurface = Object.freeze({
    roughness: look.roughness,
    metalness: 0,
    clearcoat: look.clearcoat,
    environmentIntensity: look.environmentIntensity * (isWheel ? WHEEL_ENVIRONMENT_SHARE : 1),
  })
  if (look.shading !== LookShading.PLASTIC) return plastic
  if (category === MaterialCategory.CHROME || category === MaterialCategory.METALLIC) {
    return Object.freeze({
      ...plastic,
      roughness: source.roughness,
      metalness: source.metalness,
      clearcoat: 0,
    })
  }
  if (category === MaterialCategory.RUBBER) {
    return Object.freeze({
      roughness: RUBBER_SURFACE_ROUGHNESS,
      metalness: 0,
      clearcoat: 0,
      environmentIntensity: look.environmentIntensity * RUBBER_ENVIRONMENT_SHARE,
    })
  }
  return plastic
}

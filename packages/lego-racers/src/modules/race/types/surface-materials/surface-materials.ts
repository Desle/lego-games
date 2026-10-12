import type { CollisionObject } from '../../../collision/index.ts'
import { NO_PROBE_SURFACE } from '../../../projectiles/index.ts'
import type { ProbeSurface } from '../../../projectiles/index.ts'
import type { TrackMaterial } from '../../../track-material/index.ts'
import type { SurfaceMaterials } from './surface-materials.types.ts'

const FIRST_DIGIT_CODE = 0x30
const LAST_DIGIT_CODE = 0x39

export const getIsDigitName = (name: string): boolean => {
  const code = name.charCodeAt(0)
  return code >= FIRST_DIGIT_CODE && code <= LAST_DIGIT_CODE
}

// 0x00435e70: the checkpoint object's materials in list order; the digit-named ones get checkpoints 0, 1, 2, ... .
const getCheckpointIndices = (
  checkpointObject: CollisionObject | undefined
): Map<string, number> => {
  const indices = new Map<string, number>()
  const names = checkpointObject?.materialNames ?? checkpointObject?.volume.materialNames ?? []
  for (const name of names) {
    if (getIsDigitName(name)) indices.set(name, indices.size)
  }
  return indices
}

// Race_LoadRaceDescription 0x00432e20 → 0x00435d20 and, for the checkpoint object, 0x00435e70.
export const createSurfaceMaterials = (
  trackMaterials: readonly TrackMaterial[],
  checkpointObject: CollisionObject | undefined
): SurfaceMaterials =>
  Object.freeze({
    trackMaterials: new Map(trackMaterials.map((material) => [material.name, material])),
    checkpointIndices: getCheckpointIndices(checkpointObject),
    checkpointObjectIndex: checkpointObject === undefined ? null : 1,
  })

export const getTrackMaterial = (
  surfaces: SurfaceMaterials,
  name: string | undefined
): TrackMaterial | undefined => (name === undefined ? undefined : surfaces.trackMaterials.get(name))

const SIGNAL_FLAG = 0x10
// Flag 0x10000 lets cars through (0x0042a830) and 0x20000 lets projectiles through (0x0041f730); the hazards that
// open or close a barrier (0x0048f030, 0x0048e5a0, 0x0048e600, ...) set or clear both.
const CAR_PASS_THROUGH_FLAG = 0x10000
const PROJECTILE_PASS_THROUGH_FLAG = 0x20000
const BARRIER_OPEN_FLAGS = CAR_PASS_THROUGH_FLAG | PROJECTILE_PASS_THROUGH_FLAG

// What the projectiles' line probe 0x0041f730 reads of a collision material: its track-material entry's flags
// (+0x08) and signal (+0x18). A material without an entry (property 0) is solid and silent.
export const getProbeSurface = (
  surfaces: SurfaceMaterials,
  name: string | undefined
): ProbeSurface => {
  const material = getTrackMaterial(surfaces, name)
  if (material === undefined) return NO_PROBE_SURFACE
  return Object.freeze({
    isPassThrough: (material.flags & PROJECTILE_PASS_THROUGH_FLAG) !== 0,
    signalIdentifier: (material.flags & SIGNAL_FLAG) === 0 ? null : material.fourthInteger,
  })
}

// The hazards' collision objects are track-material entries found by name (the table at race +0x27e0, 0x004119a0):
// a barrier is open when both pass-through flags are set. A name the race has no entry for changes nothing.
export const getSurfacesWithBarrierOpen = (
  surfaces: SurfaceMaterials,
  name: string,
  isOpen: boolean
): SurfaceMaterials => {
  const material = surfaces.trackMaterials.get(name)
  if (material === undefined) return surfaces
  const flags = isOpen ? material.flags | BARRIER_OPEN_FLAGS : material.flags & ~BARRIER_OPEN_FLAGS
  if (flags === material.flags) return surfaces
  const trackMaterials = new Map(surfaces.trackMaterials)
  trackMaterials.set(name, Object.freeze({ ...material, flags: flags >>> 0 }))
  return Object.freeze({ ...surfaces, trackMaterials })
}

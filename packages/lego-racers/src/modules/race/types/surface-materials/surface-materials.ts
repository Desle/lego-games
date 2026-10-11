import type { CollisionObject } from '../../../collision/index.ts'
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

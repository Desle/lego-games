import {
  buildDriverModel,
  parseBodyPartCatalog,
  parsePartGeometry,
} from '../../../figure-builder/index.ts'
import type { JamArchive } from '../../../jam-archive/index.ts'
import { parseMaterialLibrary } from '../../../material/index.ts'
import { parseModel } from '../../../model/index.ts'
import { loadGeometryScene } from '../../../scene/index.ts'
import type { ModelScene } from '../../../scene/index.ts'
import { DRIVER_ANIMATION_NAME, DRIVER_SKELETON_NAME } from '../../types/racer-appearance-names.ts'
import { BUILT_LIGHTS } from '../../types/built-lights.ts'

// BodyPartCatalog_Load 0x00498740 and FUN_00498120: the catalogue and the part materials (`bodypart.tdf`, `bodypart.mdf`)
// are in MENUDATA\PARTDB; the game's parts (mode 1, 0x00498020: the second directory and world of the catalogue) are in
// MENUDATA\PARTDB\GAMEPART.
const PART_DIRECTORY = 'MENUDATA\\PARTDB'
const GAME_PART_DIRECTORY = `${PART_DIRECTORY}\\GAMEPART`
const CATALOG_PATH = `${PART_DIRECTORY}\\BODYPART.PCB`
const PART_MATERIAL_LIBRARY = 'BODYPART'
const GEOMETRY_PATH = `${GAME_PART_DIRECTORY}\\ICB_CHAR.GCB`
const COMMON_DIRECTORY = 'GAMEDATA\\COMMON'

// FrontEnd_PrepareRaceSettings 0x0042d730 → 0x0042dfa0 (figure builder 0x0049db90): the model of the driver a local player
// made, from the five part bytes of the racer's save, on the pelvis skeleton and animations every driver has.
export const loadBuiltDriverScene = (
  archive: JamArchive,
  partBytes: readonly number[]
): ModelScene => {
  const catalog = parseBodyPartCatalog(archive.readFile(CATALOG_PATH))
  const bodyName = catalog.bodyModelNames.at(-1) ?? ''
  const model = buildDriverModel({
    catalog,
    geometry: parsePartGeometry(archive.readFile(GEOMETRY_PATH)),
    body: parseModel(archive.readFile(`${GAME_PART_DIRECTORY}\\${bodyName.toUpperCase()}.GDB`)),
    partBytes,
  })
  const materialNames = parseMaterialLibrary(
    archive.readFile(`${PART_DIRECTORY}\\${PART_MATERIAL_LIBRARY}.MDB`)
  ).materials.map((material) => material.name)
  return loadGeometryScene(
    archive,
    {
      directory: PART_DIRECTORY,
      textureNames: [PART_MATERIAL_LIBRARY],
      materialNames: [PART_MATERIAL_LIBRARY],
      ...BUILT_LIGHTS,
      bones: {
        directory: COMMON_DIRECTORY,
        skeletonName: DRIVER_SKELETON_NAME.toUpperCase(),
        animationName: DRIVER_ANIMATION_NAME.toUpperCase(),
      },
    },
    {
      positions: model.positions,
      normals: model.normals,
      textureCoordinates: model.textureCoordinates,
      batches: model.batches.map((batch) => ({
        materialIndex: materialNames.indexOf(batch.materialName),
        vertexIndices: batch.vertexIndices,
        transformIndices: batch.transformIndices,
        ...(batch.tint === null ? {} : { tint: batch.tint }),
      })),
    },
    model.scale
  )
}

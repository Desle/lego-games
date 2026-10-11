import {
  buildDriverModel,
  getBodyModelIndex,
  parseBodyPartCatalog,
  parsePartGeometry,
} from '../../../figure-builder/index.ts'
import type { JamArchive } from '../../../jam-archive/index.ts'
import { parseMaterialLibrary } from '../../../material/index.ts'
import { parseModel } from '../../../model/index.ts'
import { loadGeometryScene } from '../../../scene/index.ts'
import type { ModelScene } from '../../../scene/index.ts'
import { BUILT_LIGHTS } from '../../types/built-lights.ts'

// BodyPartCatalog mode 0 (0x00498020 with `+0x5c` = 0): the menu's parts are in MENUDATA\PARTDB\MENUPART (the first
// directory of the catalogue), with the world `cbbodies` (its geometry file `CBBODIES.GCB`).
const PART_DIRECTORY = 'MENUDATA\\PARTDB'
const MENU_PART_DIRECTORY = `${PART_DIRECTORY}\\MENUPART`
const CATALOG_PATH = `${PART_DIRECTORY}\\BODYPART.PCB`
const PART_MATERIAL_LIBRARY = 'BODYPART'
const GEOMETRY_PATH = `${MENU_PART_DIRECTORY}\\CBBODIES.GCB`
// 0x00481000: the main menu loads the animation set "legoman" (`s_legoman_004c2154`) for its figure.
const MENU_DIRECTORY = 'MENUDATA'
const MENU_ANIMATION_NAME = 'LEGOMAN'

// FUN_0047df90 → 0x0049db90 in menu mode: the figure the menus show. The body is `rr`, `hr`, `rp` or `hp` by the torso's
// and the legs' types (`torso type + legs type * 2`, 0x0049db90: a hook torso and peg legs), its skeleton the body's own
// and its animations the menu's `LEGOMAN.ADB`.
export const loadMenuDriverScene = (
  archive: JamArchive,
  partBytes: readonly number[]
): ModelScene => {
  const catalog = parseBodyPartCatalog(archive.readFile(CATALOG_PATH))
  const bodyName = (
    catalog.bodyModelNames[getBodyModelIndex(catalog, partBytes)] ?? ''
  ).toUpperCase()
  const model = buildDriverModel({
    catalog,
    geometry: parsePartGeometry(archive.readFile(GEOMETRY_PATH)),
    body: parseModel(archive.readFile(`${MENU_PART_DIRECTORY}\\${bodyName}.GDB`)),
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
        directory: MENU_PART_DIRECTORY,
        skeletonName: bodyName,
        animationName: MENU_ANIMATION_NAME,
        animationDirectory: MENU_DIRECTORY,
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

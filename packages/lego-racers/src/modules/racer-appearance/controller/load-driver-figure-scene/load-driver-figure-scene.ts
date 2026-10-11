import { buildDriverModel, parsePartGeometry } from '../../../figure-builder/index.ts'
import type { JamArchive } from '../../../jam-archive/index.ts'
import { parseMaterialLibrary } from '../../../material/index.ts'
import { parseModel } from '../../../model/index.ts'
import { loadGeometryScene } from '../../../scene/index.ts'
import type { ModelScene } from '../../../scene/index.ts'
import { BUILT_LIGHTS } from '../../types/built-lights.ts'
import type { DriverFigureFiles } from './load-driver-figure-scene.types.ts'

// BodyPartCatalog_Load 0x00498740 and FUN_00498120: the part materials (`bodypart.tdf`, `bodypart.mdf`) are in this
// directory in both modes.
export const PART_DIRECTORY = 'MENUDATA\\PARTDB'
const PART_MATERIAL_LIBRARY = 'BODYPART'

// The scene of a driver the figure builder (0x0049db90) made of five part bytes, shown with the light set of a built
// model.
export const loadDriverFigureScene = (
  archive: JamArchive,
  files: DriverFigureFiles,
  partBytes: readonly number[]
): ModelScene => {
  const model = buildDriverModel({
    catalog: files.catalog,
    geometry: parsePartGeometry(archive.readFile(files.geometryPath)),
    body: parseModel(archive.readFile(files.bodyPath)),
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
      bones: files.bones,
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

import {
  buildCarGeometry,
  getBrickColorMaterialIndices,
  parseBrickColors,
  parseBrickDatabase,
} from '../../../car-builder/index.ts'
import type { CarDesign } from '../../../car-builder/index.ts'
import type { JamArchive } from '../../../jam-archive/index.ts'
import { parseMaterialLibrary } from '../../../material/index.ts'
import { loadGeometryScene } from '../../../scene/index.ts'
import type { ModelScene } from '../../../scene/index.ts'
import { BUILT_LIGHTS } from '../../types/built-lights.ts'

// FrontEnd_PrepareRaceSettings 0x0042d730 loads the brick database `LPieceLo.leg`, the colours `L_Colors.leg` and, with
// the builder's world `LPieceLo`, the textures and materials the bricks are drawn with, all from MENUDATA\PIECEDB.
const BRICK_DIRECTORY = 'MENUDATA\\PIECEDB'
const BRICK_DATABASE_PATH = `${BRICK_DIRECTORY}\\LPIECELO.LEB`
const BRICK_COLORS_PATH = `${BRICK_DIRECTORY}\\L_COLORS.LEB`
const BRICK_MATERIAL_LIBRARY = 'LPIECELO'
const BRICK_MATERIAL_PATH = `${BRICK_DIRECTORY}\\${BRICK_MATERIAL_LIBRARY}.MDB`

// FrontEnd_BuildBuiltCarSlot 0x0042dcb0: the model of a car built from bricks, made by the mesh builder (0x0049b920,
// 0x0049c840) from its design, with the brick colours' materials of the brick material library.
export const loadBuiltCarScene = (archive: JamArchive, design: CarDesign): ModelScene => {
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const colors = parseBrickColors(archive.readFile(BRICK_COLORS_PATH))
  const materialNames = parseMaterialLibrary(archive.readFile(BRICK_MATERIAL_PATH)).materials.map(
    (material) => material.name
  )
  const geometry = buildCarGeometry(
    database,
    design,
    getBrickColorMaterialIndices(colors, materialNames)
  )
  return loadGeometryScene(
    archive,
    {
      directory: BRICK_DIRECTORY,
      textureNames: [BRICK_MATERIAL_LIBRARY],
      materialNames: [BRICK_MATERIAL_LIBRARY],
      ...BUILT_LIGHTS,
      bones: null,
    },
    geometry
  )
}

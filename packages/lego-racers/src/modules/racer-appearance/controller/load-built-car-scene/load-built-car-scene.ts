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

// FrontEnd_PrepareRaceSettings 0x0042d730 loads the brick database `LPieceLo.leg`, the colours `L_Colors.leg` and, with
// the builder's world `LPieceLo`, the textures and materials the bricks are drawn with, all from MENUDATA\PIECEDB.
const BRICK_DIRECTORY = 'MENUDATA\\PIECEDB'
const BRICK_DATABASE_PATH = `${BRICK_DIRECTORY}\\LPIECELO.LEB`
const BRICK_COLORS_PATH = `${BRICK_DIRECTORY}\\L_COLORS.LEB`
const BRICK_MATERIAL_LIBRARY = 'LPIECELO'
const BRICK_MATERIAL_PATH = `${BRICK_DIRECTORY}\\${BRICK_MATERIAL_LIBRARY}.MDB`

// FrontEnd_PrepareRaceSettings 0x0042d730 builds the light set a car built from bricks is shown with: an ambient light of
// 0x808080 (0x0040eb70) and a white directional light shining along (-1, 0, -1) (0x0040eba0). The track worlds set no
// lights, so these are the only ones a model with normals can have in the race (hypothesis: the race keeps them).
const BUILT_CAR_AMBIENT_LIGHTS = Object.freeze([Object.freeze({ color: [128, 128, 128] as const })])
const BUILT_CAR_DIRECTIONAL_LIGHTS = Object.freeze([
  Object.freeze({
    color: [255, 255, 255] as const,
    direction: Object.freeze({ x: -1, y: 0, z: -1 }),
  }),
])

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
      ambientLights: BUILT_CAR_AMBIENT_LIGHTS,
      directionalLights: BUILT_CAR_DIRECTIONAL_LIGHTS,
    },
    geometry
  )
}

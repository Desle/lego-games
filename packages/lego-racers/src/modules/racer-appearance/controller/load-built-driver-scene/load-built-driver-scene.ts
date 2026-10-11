import { parseBodyPartCatalog } from '../../../figure-builder/index.ts'
import type { JamArchive } from '../../../jam-archive/index.ts'
import type { ModelScene } from '../../../scene/index.ts'
import { DRIVER_ANIMATION_NAME, DRIVER_SKELETON_NAME } from '../../types/racer-appearance-names.ts'
import {
  loadDriverFigureScene,
  PART_DIRECTORY,
} from '../load-driver-figure-scene/load-driver-figure-scene.ts'

// BodyPartCatalog_Load 0x00498740: the catalogue is in MENUDATA\PARTDB; the game's parts (mode 1, 0x00498020: the second
// directory and world of the catalogue) are in MENUDATA\PARTDB\GAMEPART.
const GAME_PART_DIRECTORY = `${PART_DIRECTORY}\\GAMEPART`
const CATALOG_PATH = `${PART_DIRECTORY}\\BODYPART.PCB`
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
  return loadDriverFigureScene(
    archive,
    {
      catalog,
      geometryPath: GEOMETRY_PATH,
      bodyPath: `${GAME_PART_DIRECTORY}\\${bodyName.toUpperCase()}.GDB`,
      bones: {
        directory: COMMON_DIRECTORY,
        skeletonName: DRIVER_SKELETON_NAME.toUpperCase(),
        animationName: DRIVER_ANIMATION_NAME.toUpperCase(),
      },
    },
    partBytes
  )
}

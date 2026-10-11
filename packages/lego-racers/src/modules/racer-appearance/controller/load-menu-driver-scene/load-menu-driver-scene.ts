import { getBodyModelIndex, parseBodyPartCatalog } from '../../../figure-builder/index.ts'
import type { JamArchive } from '../../../jam-archive/index.ts'
import type { ModelScene } from '../../../scene/index.ts'
import {
  loadDriverFigureScene,
  PART_DIRECTORY,
} from '../load-driver-figure-scene/load-driver-figure-scene.ts'

// BodyPartCatalog mode 0 (0x00498020 with `+0x5c` = 0): the menu's parts are in MENUDATA\PARTDB\MENUPART (the first
// directory of the catalogue), with the world `cbbodies` (its geometry file `CBBODIES.GCB`).
const MENU_PART_DIRECTORY = `${PART_DIRECTORY}\\MENUPART`
const CATALOG_PATH = `${PART_DIRECTORY}\\BODYPART.PCB`
const GEOMETRY_PATH = `${MENU_PART_DIRECTORY}\\CBBODIES.GCB`
// 0x00481000: the main menu loads the animation set "legoman" (`s_legoman_004c2154`) for its figure.
const MENU_DIRECTORY = 'MENUDATA'
const MENU_ANIMATION_NAME = 'LEGOMAN'

// FUN_0047df90 → 0x0049db90 in menu mode: the figure the menus show. The body is `rr`, `hr`, `rp` or `hp` by the torso's
// and the legs' types (`torso type + legs type * 2`, 0x0049db90: a hook torso and peg legs), its skeleton the body's own
// and its animations the menu's `LEGOMAN.ADB`.
export const loadMenuDriverScene = (
  archive: JamArchive,
  partBytes: readonly number[],
  animationName: string = MENU_ANIMATION_NAME
): ModelScene => {
  const catalog = parseBodyPartCatalog(archive.readFile(CATALOG_PATH))
  const bodyName = (
    catalog.bodyModelNames[getBodyModelIndex(catalog, partBytes)] ?? ''
  ).toUpperCase()
  return loadDriverFigureScene(
    archive,
    {
      catalog,
      geometryPath: GEOMETRY_PATH,
      bodyPath: `${MENU_PART_DIRECTORY}\\${bodyName}.GDB`,
      bones: {
        directory: MENU_PART_DIRECTORY,
        skeletonName: bodyName,
        animationName,
        animationDirectory: MENU_DIRECTORY,
      },
    },
    partBytes
  )
}

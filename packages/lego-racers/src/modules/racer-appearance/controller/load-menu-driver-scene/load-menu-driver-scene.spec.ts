import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { loadMenuDriverScene } from './load-menu-driver-scene.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const MENU_FIGURE_SCALE = 1 / 64
// Captain Redbeard's part bytes (DRIVERS.DDB `cr`): the main menu's figure.
const CAPTAIN_REDBEARD_PART_BYTES = [4, 4, 24, 10, 0]

describe('loadMenuDriverScene', () => {
  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'builds one skeletal figure with the menu animations of LEGOMAN.ADB',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))

      // Act
      const { scene, meshScales } = loadMenuDriverScene(archive, CAPTAIN_REDBEARD_PART_BYTES)

      // Assert
      expect(scene.instances).toHaveLength(1)
      expect(scene.skeletons).toHaveLength(1)
      expect(scene.animations).toHaveLength(1)
      expect(meshScales).toEqual([MENU_FIGURE_SCALE])
    }
  )
})

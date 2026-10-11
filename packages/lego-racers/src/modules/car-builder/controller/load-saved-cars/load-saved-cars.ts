import { loadCarDesign } from '../load-car-design/load-car-design.ts'
import { parseBrickDatabase } from '../parse-brick-database/parse-brick-database.ts'
import { parseSaveFile } from '../parse-save-file/parse-save-file.ts'
import type { SavedCar } from '../../types/save-file.types.ts'

// The menu data the builder reads (0x0042d730): the brick database and the racer saves.
export const BRICK_DATABASE_PATH = 'MENUDATA\\PIECEDB\\LPIECELO.LEB'
export const DEFAULT_SAVE_PATH = 'MENUDATA\\DEFAULT.LRS'
export const QUICK_BUILD_SAVE_PATH = 'MENUDATA\\QBUILD.LRS'

// A racer save with each racer's design loaded onto the grid as the builder would load it (a design the builder
// refuses, more than 0x40 bricks, is null).
export const loadSavedCars = (
  readFile: (path: string) => Uint8Array,
  savePath: string
): readonly SavedCar[] => {
  const database = parseBrickDatabase(readFile(BRICK_DATABASE_PATH))
  return Object.freeze(
    parseSaveFile(readFile(savePath)).racers.map((racer) =>
      Object.freeze({ record: racer, design: loadCarDesign(racer.designBytes, database) })
    )
  )
}

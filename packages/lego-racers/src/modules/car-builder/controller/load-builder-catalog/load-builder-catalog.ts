import type { BuilderCatalog } from '../../types/builder-session/builder-session.types.ts'
import { parseBrickColors } from '../parse-brick-colors/parse-brick-colors.ts'
import { parseBrickDatabase } from '../parse-brick-database/parse-brick-database.ts'
import { parseCarSet, parseCarSetFileNames } from '../parse-car-sets/parse-car-sets.ts'

const PIECE_DIRECTORY = 'MENUDATA\\PIECEDB'
const BRICK_DATABASE_PATH = `${PIECE_DIRECTORY}\\LPIECELO.LEB`
const BRICK_COLORS_PATH = `${PIECE_DIRECTORY}\\L_COLORS.LEB`
const CAR_SET_MANAGER_PATH = `${PIECE_DIRECTORY}\\CRSTMGR.LEB`
// CRSTMGR.LEB names the sets `xx_cset.leg` (the text twin); the binary file has the extension `.LEB`.
const TEXT_EXTENSION = /\.leg$/i

// 0x0042d730: the front end loads the brick database, the colours and the car sets the builder offers.
export const loadBuilderCatalog = (
  readFile: (path: string) => Uint8Array
): BuilderCatalog => {
  const database = parseBrickDatabase(readFile(BRICK_DATABASE_PATH))
  const colors = parseBrickColors(readFile(BRICK_COLORS_PATH))
  const sets = parseCarSetFileNames(readFile(CAR_SET_MANAGER_PATH)).map((name) =>
    parseCarSet(
      readFile(`${PIECE_DIRECTORY}\\${name.replace(TEXT_EXTENSION, '.LEB').toUpperCase()}`),
      database,
      colors
    )
  )
  return Object.freeze({ database, colors, sets: Object.freeze(sets) })
}

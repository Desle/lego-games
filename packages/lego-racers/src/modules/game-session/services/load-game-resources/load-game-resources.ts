import { parseCircuitDatabase } from '../../../circuit-database/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseRaceCatalog } from '../../../race-catalog/index.ts'
import type { GameResources } from '../../types/game-session.types.ts'

const CIRCUITS_PATH = 'MENUDATA\\LEGORACE.CRB'
const CATALOG_PATH = 'MENUDATA\\LEGORACE.RCB'

// FrontEnd_LoadCircuitsAndRaces 0x0042d1e0: Circuits_Load and RaceCatalog_Load of the menus' "LEGORace" files.
export const loadGameResources = (jam: Uint8Array, executable: Uint8Array): GameResources => {
  const archive = openJamArchive(jam)
  const circuits = parseCircuitDatabase(archive.readFile(CIRCUITS_PATH))
  const catalog = parseRaceCatalog(archive.readFile(CATALOG_PATH), circuits)
  return Object.freeze({ jam, executable, archive, circuits, catalog })
}

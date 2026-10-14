import { findNamedRecord } from '../../../named-record/index.ts'
import type { RacerDatabases } from '../../../racer-setup/index.ts'
import { getString, parseStringTable } from '../../../string-table/index.ts'
import type { RacerNameRequest } from './racer-names.types.ts'

// 0x00420eb0 loads `drivers.srf` from the language folder the race reads `game.srf` from (the viewer's is English).
const DRIVER_NAMES_PATH = 'GAMEDATA\\COMMON\\ENGLISH\\DRIVERS.SRF'

// Racer +0xdec (0x00436df0): the description's display name. A champion's is its driver's name string (description
// +0x18, 0x00421090: record +0x00 looked up in drivers.srf); a car built from bricks has none and takes the description's
// first bytes, its slot's name (slot +0x30, which 0x0043b480 copies for an empty racer code).
export const getRacerNames = (
  readFile: (path: string) => Uint8Array,
  databases: RacerDatabases,
  request: RacerNameRequest
): readonly string[] => {
  const driverNames = parseStringTable(readFile(DRIVER_NAMES_PATH))
  return Object.freeze(
    Array.from({ length: request.racerCount }, (_, index) => {
      if (index < request.localPlayerCount && !request.isPlayerChampionCar) {
        return request.playerNames[index] ?? ''
      }
      const driver = findNamedRecord(databases.drivers.drivers, request.racerCodes[index] ?? '')
      return driver === null ? '' : (getString(driverNames, driver.nameStringIdentifier) ?? '')
    })
  )
}

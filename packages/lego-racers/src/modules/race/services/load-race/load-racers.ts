import { parseChampionDatabase } from '../../../champion-database/index.ts'
import { parseChassisDatabase } from '../../../chassis-database/index.ts'
import { parseCircuitDatabase } from '../../../circuit-database/index.ts'
import { parseDriverDatabase } from '../../../driver-database/index.ts'
import { findNamedRecord } from '../../../named-record/index.ts'
import { parseRaceCatalog } from '../../../race-catalog/index.ts'
import {
  getBuiltRacerAppearance,
  getChampionRacerAppearance,
} from '../../../racer-appearance/index.ts'
import type { RacerAppearance } from '../../../racer-appearance/index.ts'
import { describeBuiltRacer, describeChampionRacer } from '../../../racer-setup/index.ts'
import type { BuiltCar, RacerDatabases, RacerDescription } from '../../../racer-setup/index.ts'
import { UnknownRaceError } from './load-race-errors.ts'
import type { RacerDescriptionRequest } from './load-race.types.ts'

const JAM_SEPARATOR = '\\'
// 0x0042c4e0 sets this directory before RacerSet_Setup (0x0043b190) loads the databases.
const DATABASE_FOLDER = 'GAMEDATA\\COMMON'
// 0x0042d1e0 loads LEGORace.crb and LEGORace.rcb from the menu data.
const MENU_FOLDER = 'MENUDATA'

// Drivers_Load, Champions_Load and Chassis_Load (RacerSet_Setup 0x0043b190): "drivers", "champs" and "chassis".
export const readRacerDatabases = (readFile: (path: string) => Uint8Array): RacerDatabases =>
  Object.freeze({
    drivers: parseDriverDatabase(readFile(`${DATABASE_FOLDER}${JAM_SEPARATOR}DRIVERS.DDB`)),
    champions: parseChampionDatabase(readFile(`${DATABASE_FOLDER}${JAM_SEPARATOR}CHAMPS.CCB`)),
    chassis: parseChassisDatabase(readFile(`${DATABASE_FOLDER}${JAM_SEPARATOR}CHASSIS.CMB`)),
  })

// The racer codes of the circuit a race belongs to. LEGORACE.RCB names each race by its folder (`firstName`) and
// its circuit; the circuit lists the drivers (LEGORACE.CRB). 0x0042d730 copies code i into racer slot i.
export const getCircuitRacerCodes = (
  readFile: (path: string) => Uint8Array,
  raceFolder: string
): readonly string[] => {
  const circuits = parseCircuitDatabase(readFile(`${MENU_FOLDER}${JAM_SEPARATOR}LEGORACE.CRB`))
  const catalog = parseRaceCatalog(readFile(`${MENU_FOLDER}${JAM_SEPARATOR}LEGORACE.RCB`), circuits)
  const entry = catalog.entries.find(
    (candidate) => candidate.firstName.toUpperCase() === raceFolder.toUpperCase()
  )
  const circuit = entry === undefined ? null : findNamedRecord(circuits.circuits, entry.circuitName)
  if (circuit === null) throw new UnknownRaceError(raceFolder)
  return circuit.racerCodes
}

// The car of a local player: the builder's answer for its slot, else the first one (the front end has loaded at
// least `default.lrs`, whose first racer a player without a save of its own drives).
const getPlayerCar = (request: RacerDescriptionRequest, index: number): BuiltCar => {
  const car = request.playerCars[index] ?? request.playerCars[0]
  if (car === undefined) throw new RangeError(`No car for local player ${String(index)}`)
  return car
}

// 0x0043b480 for every racer of the race.
export const describeRacers = (request: RacerDescriptionRequest): readonly RacerDescription[] =>
  Array.from({ length: request.racerCount }, (_, index) => {
    if (index < request.localPlayerCount) {
      return describeBuiltRacer(
        request.arithmetic,
        request.databases,
        getPlayerCar(request, index),
        index
      )
    }
    const code = request.racerCodes[index]
    if (code === undefined) throw new RangeError(`No driver code for racer ${String(index)}`)
    return describeChampionRacer(request.databases, code)
  })

// The files each racer's car and driver are drawn from, for the racers of 0x0043b480.
export const describeAppearances = (request: RacerDescriptionRequest): readonly RacerAppearance[] =>
  Array.from({ length: request.racerCount }, (_, index) => {
    if (index < request.localPlayerCount) {
      return getBuiltRacerAppearance(
        request.databases,
        getPlayerCar(request, index).chassisName,
        index
      )
    }
    const code = request.racerCodes[index]
    if (code === undefined) throw new RangeError(`No driver code for racer ${String(index)}`)
    return getChampionRacerAppearance(request.databases, code, index)
  })

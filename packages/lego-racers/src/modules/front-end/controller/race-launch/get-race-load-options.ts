import type { LoadRaceOptions } from '../../../race/index.ts'
import type { FrontEndRaceRequest } from '../../types/front-end.types.ts'

// The race the request starts: a single race or time trial runs the race the player chose; a circuit race runs the
// first of its races (the circuit's four races in a row are the circuit progression, another module's work, which
// reads `circuitRaces`).
const getRaceFolder = (request: FrontEndRaceRequest): string =>
  request.mode === 'circuit' && request.circuitRaces.length > 0
    ? (request.circuitRaces[0]?.raceFolder ?? '')
    : request.raceFolder

// LoadRaceOptions (race/services/load-race) from the settings the menus produced: the game settings `+0x100` (racer
// count) and `+0x32c` (local players), the race's folder and the laps of a versus race.
export const getRaceLoadOptions = (request: FrontEndRaceRequest): LoadRaceOptions => {
  const raceFolder = getRaceFolder(request)
  return {
    ...(raceFolder === '' ? {} : { raceFolder: raceFolder.toUpperCase() }),
    racerCount: request.racerCount,
    localPlayerCount: request.localPlayerCount,
    multiplayerLapCount: request.lapCount,
  }
}

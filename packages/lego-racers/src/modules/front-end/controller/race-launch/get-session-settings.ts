import {
  createCircuitSettings,
  createSingleRaceSettings,
  createTimeTrialSettings,
} from '../../../game-session/index.ts'
import type { GameResources, SessionSettings } from '../../../game-session/index.ts'
import type { FrontEndRaceRequest } from '../../types/front-end.types.ts'

// The game settings block the menus filled (FrontEnd_PrepareRaceSettings 0x0042d730) as the session's settings: a
// circuit plays the four races of its circuit, a single race and a time trial the race the player chose.
export const getSessionSettings = (
  resources: GameResources,
  request: FrontEndRaceRequest,
  randomPosition: number
): SessionSettings => {
  const common = {
    racerCount: request.racerCount,
    localPlayerCount: request.localPlayerCount,
    multiplayerLapCount: request.lapCount,
    randomPosition,
    playerSavedCars: request.playerCar === null ? [] : [request.playerCar],
    playerNames: request.playerCar === null ? [] : [request.playerCar.record.name],
  }
  if (request.mode === 'circuit') {
    return createCircuitSettings(resources, { ...common, circuitName: request.circuitName })
  }
  if (request.mode === 'time_trial') {
    return createTimeTrialSettings(resources, { ...common, raceName: request.raceName })
  }
  return createSingleRaceSettings(resources, { ...common, raceName: request.raceName })
}

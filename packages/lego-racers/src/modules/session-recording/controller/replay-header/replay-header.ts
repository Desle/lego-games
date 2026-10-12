import {
  loadBuilderCatalog,
  loadCarDesign,
  serializeCarDesign,
} from '../../../car-builder/index.ts'
import type { SavedCar } from '../../../car-builder/index.ts'
import { getRaceLoadOptions } from '../../../game-session/index.ts'
import type { RaceStart } from '../../../game-session/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import type { LoadRaceOptions } from '../../../race/index.ts'
import type { ReplayHeader, ReplayPlayerRacer } from '../../types/session-recording.types.ts'
import { REPLAY_FORMAT, REPLAY_VERSION } from '../replay-format/replay-format.ts'

const getPlayerRacer = (saved: SavedCar): ReplayPlayerRacer =>
  Object.freeze({
    record: saved.record,
    designBytes: saved.design === null ? null : [...serializeCarDesign(saved.design)],
  })

// A race that plays a ghost (a time trial) carries state the recording does not hold: no header, no recording.
export const createReplayHeader = (
  start: RaceStart,
  remasteredSelections: readonly string[] | null = null
): ReplayHeader | null => {
  if (start.session.ghost !== null) return null
  const options = getRaceLoadOptions(start.session, start.race, null)
  return Object.freeze({
    format: REPLAY_FORMAT,
    version: REPLAY_VERSION,
    raceFolder: start.race.folder,
    circuitName: start.session.settings.circuitName,
    racerCodes: options.racerCodes ?? null,
    racerCount: options.racerCount ?? 0,
    localPlayerCount: options.localPlayerCount ?? 0,
    raceModeFlags: options.raceModeFlags ?? 0,
    randomPosition: options.randomPosition ?? 0,
    isMirrored: options.isMirrored ?? false,
    multiplayerLapCount: options.multiplayerLapCount ?? 0,
    isPointsRecordPresent: options.isPointsRecordPresent ?? false,
    isCountdownSkipped: start.definition.isCountdownSkipped,
    playerCars: options.playerCars ?? [],
    playerRacers: (options.playerSavedCars ?? []).map(getPlayerRacer),
    ...(remasteredSelections === null ? {} : { isRemastered: true, remasteredSelections }),
  })
}

// The options that load the recorded race again from the player's own LEGO.JAM.
export const getReplayLoadOptions = (header: ReplayHeader, jam: Uint8Array): LoadRaceOptions => {
  const { database } = loadBuilderCatalog(openJamArchive(jam).readFile)
  return {
    raceFolder: header.raceFolder,
    racerCount: header.racerCount,
    localPlayerCount: header.localPlayerCount,
    raceModeFlags: header.raceModeFlags,
    randomPosition: header.randomPosition,
    playerCars: header.playerCars,
    playerSavedCars: header.playerRacers.map((racer) => ({
      record: racer.record,
      design:
        racer.designBytes === null
          ? null
          : loadCarDesign(Uint8Array.from(racer.designBytes), database),
    })),
    ...(header.racerCodes === null ? {} : { racerCodes: header.racerCodes }),
    isMirrored: header.isMirrored,
    multiplayerLapCount: header.multiplayerLapCount,
    isPointsRecordPresent: header.isPointsRecordPresent,
  }
}

import { decodeSoundBank } from '../../../audio/index.ts'
import { parseRaceDescription } from '../../../race-description/index.ts'
import { createCircuitStandings } from '../../../circuit-standings/index.ts'
import { createGhostSession } from '../../../ghost/index.ts'
import { parseLoadScreen } from '../../../load-screen/index.ts'
import { findNamedRecord } from '../../../named-record/index.ts'
import { drawRandomValue, createRandomTablePosition } from '../../../random-table/index.ts'
import { readRacerTables } from '../../../racer/index.ts'
import type { RaceCatalogEntry } from '../../../race-catalog/index.ts'
import type {
  GameResources,
  GameSession,
  RaceTimeRecord,
  SessionRace,
  SessionSettings,
} from '../../types/game-session.types.ts'
import {
  CIRCUIT_SLOT_COUNT,
  DEMONSTRATION_CIRCUIT_NAME,
  DEMONSTRATION_RACER_COUNT,
  DEMONSTRATION_SLOT_MASK,
  GAME_MODE_NUMBERS,
  GameMode,
  GARAGE_RESULT_SCREEN,
  MIRRORED_FINAL_CIRCUIT_NAME,
  MIRRORED_FINAL_FLAG,
  MENU_RESULT_SCREEN,
  TIME_TRIAL_OPPONENT_COUNT,
} from '../../types/session-rules/session-rules.ts'
import type {
  CircuitSettingsRequest,
  DemonstrationRequest,
  SettingsRequest,
  SingleRaceSettingsRequest,
} from './create-game-session.types.ts'

const DEFAULT_MULTIPLAYER_LAP_COUNT = 3
const NO_TIME_RECORD: RaceTimeRecord = Object.freeze({
  bestLapMilliseconds: 0,
  bestLapRacerIndex: 0,
  bestRaceMilliseconds: 0,
  bestRaceRacerIndex: 0,
})

const getCircuitEntries = (
  resources: GameResources,
  circuitName: string
): readonly (RaceCatalogEntry | null)[] =>
  Array.from({ length: CIRCUIT_SLOT_COUNT }, (_, slot) => {
    // RaceCatalog_Load 0x004366f0 stores a race at circuit +0x48 + 4 · number, a later race over an earlier one.
    const entries = resources.catalog.entries.filter(
      (entry) => entry.circuitName === circuitName && entry.raceNumber === slot
    )
    return entries.at(-1) ?? null
  })

const getBaseSettings = (
  mode: SessionSettings['mode'],
  circuitName: string,
  raceNames: readonly (string | null)[],
  request: SettingsRequest
): SessionSettings =>
  Object.freeze({
    mode,
    circuitName,
    raceNames: Object.freeze(raceNames),
    racerCount: request.racerCount,
    localPlayerCount: request.localPlayerCount,
    multiplayerLapCount: request.multiplayerLapCount ?? DEFAULT_MULTIPLAYER_LAP_COUNT,
    // FUN_0042d730 clears the race mode flags for a circuit and a time trial.
    raceModeFlags: mode === GameMode.SINGLE_RACE ? (request.raceModeFlags ?? 0) : 0,
    isCountdownSkipped: request.isCountdownSkipped ?? false,
    playerCars: Object.freeze(request.playerCars ?? []),
    playerSavedCars: Object.freeze(request.playerSavedCars ?? []),
    playerNames: Object.freeze(request.playerNames ?? []),
    randomPosition: request.randomPosition ?? 0,
  })

// The circuit menu (FUN_0047a0e0): mode 0, the circuit's key, and the circuit's four slots with the race of each.
export const createCircuitSettings = (
  resources: GameResources,
  request: CircuitSettingsRequest
): SessionSettings =>
  getBaseSettings(
    GameMode.CIRCUIT,
    request.circuitName,
    getCircuitEntries(resources, request.circuitName).map((entry) => entry?.name ?? null),
    request
  )

// The single race menu (FUN_00487d40): the race is slot 0, the circuit is the race's own.
export const createSingleRaceSettings = (
  resources: GameResources,
  request: SingleRaceSettingsRequest
): SessionSettings => {
  const entry = resources.catalog.entries.find((candidate) => candidate.name === request.raceName)
  if (entry === undefined) throw new RangeError(`LEGORACE.RCB lists no race ${request.raceName}`)
  return getBaseSettings(GameMode.SINGLE_RACE, entry.circuitName, [entry.name], request)
}

// FUN_00487f90 and FUN_0042d730 for the time trial: no opponents, so the player is the only racer.
export const createTimeTrialSettings = (
  resources: GameResources,
  request: Omit<SingleRaceSettingsRequest, 'racerCount'>
): SessionSettings => {
  const settings = createSingleRaceSettings(resources, {
    ...request,
    racerCount: TIME_TRIAL_OPPONENT_COUNT,
  })
  return Object.freeze({
    ...settings,
    mode: GameMode.TIME_TRIAL,
    racerCount: Math.max(settings.racerCount, settings.localPlayerCount),
  })
}

// FUN_0042d730 with no local player (the attract mode): six racers on one of the four races of the first circuit,
// chosen with the next entry of the random table.
export const createDemonstrationSettings = (
  resources: GameResources,
  request: DemonstrationRequest
): SessionSettings => {
  const { randomTable } = readRacerTables(resources.executable)
  const draw = drawRandomValue(randomTable, createRandomTablePosition(request.randomPosition))
  const entry = getCircuitEntries(resources, DEMONSTRATION_CIRCUIT_NAME)[
    draw.value & DEMONSTRATION_SLOT_MASK
  ]
  return getBaseSettings(GameMode.SINGLE_RACE, DEMONSTRATION_CIRCUIT_NAME, [entry?.name ?? null], {
    racerCount: DEMONSTRATION_RACER_COUNT,
    localPlayerCount: 0,
    randomPosition: draw.position,
  })
}

const getSessionRace = (
  resources: GameResources,
  slot: number,
  raceName: string | null,
  isMirroredByOption: boolean
): SessionRace | null => {
  if (raceName === null) return null
  const entry = resources.catalog.entries.find((candidate) => candidate.name === raceName)
  if (entry === undefined) throw new RangeError(`LEGORACE.RCB lists no race ${raceName}`)
  const folder = entry.firstName.toUpperCase()
  const description = parseRaceDescription(
    resources.archive.readFile(`GAMEDATA\\${folder}\\${folder}.RAB`),
    entry.isFlagged
  )
  const musicPaths =
    description.musicList === null
      ? []
      : decodeSoundBank(
          resources.archive.readFile(`GAMEDATA\\${folder}\\${description.musicList.toUpperCase()}`)
        ).soundPaths
  const loadScreenPath = `GAMEDATA\\${folder}\\LOADSCRN.LSB`
  return Object.freeze({
    slot,
    entry,
    folder,
    isMirrored: entry.isFlagged || (slot === 0 && isMirroredByOption),
    musicTunePaths: Object.freeze(musicPaths),
    loadScreen: resources.archive.getFilePaths().includes(loadScreenPath)
      ? parseLoadScreen(resources.archive.readFile(loadScreenPath))
      : null,
  })
}

// RaceSession_Begin 0x0042c280: the result screen starts as 2 (3 for a garage test drive), the slot counter at 0; a
// circuit gets its points record (CircuitRunner_Begin 0x0041ed10), a time trial its ghost (FUN_00422420).
export const createGameSession = (
  resources: GameResources,
  settings: SessionSettings
): GameSession => {
  if (findNamedRecord(resources.circuits.circuits, settings.circuitName) === null) {
    throw new RangeError(`LEGORACE.CRB lists no circuit ${settings.circuitName}`)
  }
  // FUN_0042d730: race mode flag 0x20 in a single race of circuit c6 (the final) mirrors the race.
  const isMirroredByOption =
    settings.mode === GameMode.SINGLE_RACE &&
    (settings.raceModeFlags & MIRRORED_FINAL_FLAG) !== 0 &&
    settings.circuitName === MIRRORED_FINAL_CIRCUIT_NAME
  const races = settings.raceNames.map((raceName, slot) =>
    getSessionRace(resources, slot, raceName, isMirroredByOption)
  )
  const firstRace = races.find((race) => race !== null) ?? null
  return Object.freeze({
    settings,
    resources,
    races: Object.freeze(races),
    raceIndex: 0,
    isRestartRequested: false,
    isAborted: false,
    standings: settings.mode === GameMode.CIRCUIT ? createCircuitStandings() : null,
    pointsTickerMilliseconds: 0,
    raceTimes: Object.freeze(races.map(() => NO_TIME_RECORD)),
    resultScreen: settings.isCountdownSkipped ? GARAGE_RESULT_SCREEN : MENU_RESULT_SCREEN,
    isFinished: false,
    ghost:
      settings.mode === GameMode.TIME_TRIAL
        ? createGhostSession(firstRace?.isMirrored ?? false)
        : null,
    isTimeRecordPending: false,
    isChampionBeaten: false,
    randomPosition: settings.randomPosition,
  })
}

export const getGameModeNumber = (mode: SessionSettings['mode']): number =>
  GAME_MODE_NUMBERS[mode] ?? 0

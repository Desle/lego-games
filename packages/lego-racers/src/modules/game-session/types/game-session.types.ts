import type { SavedCar } from '../../car-builder/index.ts'
import type { CircuitStandings } from '../../circuit-standings/index.ts'
import type { CircuitDatabase } from '../../circuit-database/index.ts'
import type { GhostSession } from '../../ghost/index.ts'
import type { JamArchive } from '../../jam-archive/index.ts'
import type { LoadScreen } from '../../load-screen/index.ts'
import type { RaceCatalog, RaceCatalogEntry } from '../../race-catalog/index.ts'
import type { RaceDefinition } from '../../race/index.ts'
import type { BuiltCar } from '../../racer-setup/index.ts'
import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { GameMode as GameModeValues } from './session-rules/session-rules.ts'

export type GameMode = EnumValues<typeof GameModeValues>

// The player's own game files, parsed as far as the session needs: the circuits and the races of the menus.
export type GameResources = {
  readonly jam: Uint8Array
  readonly executable: Uint8Array
  readonly archive: JamArchive
  readonly circuits: CircuitDatabase
  readonly catalog: RaceCatalog
}

// What the front end puts in the game settings block before it asks for a session (FUN_0042d730).
export type SessionSettings = {
  readonly mode: GameMode
  // Settings +0x2d: the key of the circuit (LEGORACE.CRB) whose drivers race.
  readonly circuitName: string
  // Settings +0x38 + 0x18 · i: the catalog key (LEGORACE.RCB) of each race slot, null for an empty slot. A circuit
  // has four slots; a single race and a time trial use the first.
  readonly raceNames: readonly (string | null)[]
  // Settings +0x100.
  readonly racerCount: number
  // Settings +0x32c: 0 is a demonstration.
  readonly localPlayerCount: number
  // Settings +0x2c: the laps with two or more local players.
  readonly multiplayerLapCount: number
  // Settings +0x20.
  readonly raceModeFlags: number
  // Settings +0x1e bit 2.
  readonly isCountdownSkipped: boolean
  // The cars the local players built (settings +0x104 + 0x5c · i), by player.
  readonly playerCars: readonly BuiltCar[]
  // The designs of those cars when the menus built them in this session (empty: the save's racers drive).
  readonly playerSavedCars: readonly SavedCar[]
  // The names of the racer slots (settings +0x134 + 0x5c · i), used for the best times.
  readonly playerNames: readonly string[]
  // The random table cursor (0x004c6ee4) when the session starts.
  readonly randomPosition: number
}

// A race slot resolved against the catalog.
export type SessionRace = {
  readonly slot: number
  readonly entry: RaceCatalogEntry
  // The folder below GAMEDATA, in the case of the JAM.
  readonly folder: string
  // LEGORACE.RCB's flag: the track is run mirrored.
  readonly isMirrored: boolean
  // The race's music list (RAB keyword 0x30, `LEGOMSC`): the .tun files of its tunes, in the list's order. Tune 0
  // plays during the introduction, 1 (or a draw among 4 to 6 outside a circuit) during the race, 2 after a loss, 3
  // after a win; the files sit in the game folder, not in LEGO.JAM.
  readonly musicTunePaths: readonly string[]
  // GAMEDATA\<folder>\LOADSCRN.LSB (LoadScreen_Load 0x0042f480), when the folder has one.
  readonly loadScreen: LoadScreen | null
}

// Settings +0x98.. : the best lap and the best race time of a slot with the racer that set them (FUN_0043beb0).
// A time of 0 is none.
export type RaceTimeRecord = {
  readonly bestLapMilliseconds: number
  readonly bestLapRacerIndex: number
  readonly bestRaceMilliseconds: number
  readonly bestRaceRacerIndex: number
}

export type GameSession = {
  readonly settings: SessionSettings
  readonly resources: GameResources
  readonly races: readonly (SessionRace | null)[]
  // Settings +0xd8: the slot the circuit runner is at; it counts empty slots too.
  readonly raceIndex: number
  // Settings +0x1e bit 0x20: the pause menu asked to start the circuit over.
  readonly isRestartRequested: boolean
  // Settings +0x1e bit 0x08: the player left through the pause menu.
  readonly isAborted: boolean
  // The circuit runner's points record (null outside a circuit).
  readonly standings: CircuitStandings | null
  // The record's +0x40, the points table's blink countdown (0x00440330): the record outlives each race, so it runs on.
  readonly pointsTickerMilliseconds: number
  // One record per slot.
  readonly raceTimes: readonly RaceTimeRecord[]
  // Settings +0x1c.
  readonly resultScreen: number
  readonly isFinished: boolean
  // Race +0x3364 (a time trial): the ghost object; the champion of the race that runs is loaded into it.
  readonly ghost: GhostSession | null
  // Settings +0x1e bit 0x10: a race with a ghost ended, so the front end records the times.
  readonly isTimeRecordPending: boolean
  // Settings +0x1e bit 0x01: the best run beat the champion ghost.
  readonly isChampionBeaten: boolean
  // The random table cursor after the races so far.
  readonly randomPosition: number
}

export type RaceStart = {
  readonly kind: 'race'
  readonly session: GameSession
  readonly race: SessionRace
  readonly definition: RaceDefinition
}

export type SessionEnd = {
  readonly kind: 'finished'
  readonly session: GameSession
}

export type SessionStep = RaceStart | SessionEnd

// How the circuit ended for the first human racer.
export type CircuitOutcome = {
  // Settings +0x1c: 0x16, 0x17, 0x18 or 0x19.
  readonly resultScreen: number
  // 0 is first (FUN_00440300).
  readonly rank: number
  // The racer slot whose rank it is: the first with a human controller.
  readonly racerIndex: number
}

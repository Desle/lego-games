import type { GhostSession } from '../../../ghost/index.ts'
import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import type { RandomDraw, RandomTablePosition } from '../../../random-table/index.ts'
import type { BuiltCar, RacerDatabases } from '../../../racer-setup/index.ts'
import type { FloatArithmetic, FpuPrecisionValue } from '../../../simulation-math/index.ts'

export type LoadRaceOptions = {
  // The x87 precision the race runs in; the default is RACE_FPU_PRECISION.
  readonly fpuPrecision?: FpuPrecisionValue
  // The local players drive the champion car of their racer code instead of a car built from bricks (the golden
  // trace needs this: a built car's model comes from the car builder, which the emulator does not run).
  readonly isPlayerChampionCar?: boolean
  // The race's folder below GAMEDATA; the first race is RACEC0R0.
  readonly raceFolder?: string
  // Game settings +0x100: racer 0 is the player, the others are computer racers.
  readonly racerCount?: number
  // Game settings +0x20.
  readonly raceModeFlags?: number
  // Game settings +0x32c. The first racers, as many as there are local players, drive cars built from bricks.
  readonly localPlayerCount?: number
  // The random table position (0x004c6ee4) when the race loads; the menus advance it before.
  readonly randomPosition?: number
  // The car builder's answer for each local player (the racer slot's chassis, weight and centre offsets); a player
  // without one gets a car of the first chassis with no weight.
  readonly playerCars?: readonly BuiltCar[]
  // The driver code of each racer slot, instead of the codes of the race's circuit in LEGORACE.CRB.
  readonly racerCodes?: readonly string[]
  // Game settings +0x3c of the race (LEGORACE.RCB's flag, set for the mirrored second pass of a circuit): every
  // loader negates the y of what it reads (Race_LoadTrackContent's argument).
  readonly isMirrored?: boolean
  // Game settings +0x2c: the laps of a race with two or more local players (the front end's option, 2 or 3 in the
  // shipped save files); one local player always races 3.
  readonly multiplayerLapCount?: number
  // Race +0x18 != 0: the race is part of a circuit and its results stay on screen for 5 s.
  readonly isPointsRecordPresent?: boolean
  // Race +0x3364: the time trial's ghost object (the race session loads the champion into it first).
  readonly ghost?: GhostSession | null
  // The tunes the race's music stream can play; the default is the count of the race's music list. 0 is a race
  // with no music stream (the music files are missing), which also spares the random draw for the racing tune.
  readonly musicTuneCount?: number
}

// The routes chosen so far (null for a racer without one) and the table position after their draws.
export type RouteDraws = {
  readonly routes: readonly (ComputerRacerRoute | null)[]
  readonly position: RandomTablePosition
}

export type RouteFiles = {
  readonly folder: string
  readonly isMirrored: boolean
  readonly readFile: (path: string) => Uint8Array
  readonly getIsPresent: (path: string) => boolean
}

export type RouteDrawer = (position: RandomTablePosition) => RandomDraw

export type RacerDescriptionRequest = {
  readonly arithmetic: FloatArithmetic
  readonly databases: RacerDatabases
  readonly racerCount: number
  // Racers 0 to count − 1 drive cars built from bricks (an empty name in the racer slot).
  readonly localPlayerCount: number
  readonly playerCars: readonly BuiltCar[]
  readonly defaultPlayerCar: BuiltCar
  // The driver code of every racer slot (0x0042d730 fills slot i with code i; the players overwrite theirs).
  readonly racerCodes: readonly string[]
  readonly isPlayerChampionCar: boolean
}

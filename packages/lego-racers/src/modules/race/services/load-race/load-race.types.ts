import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import type { RandomDraw, RandomTablePosition } from '../../../random-table/index.ts'
import type { BuiltCar, RacerDatabases } from '../../../racer-setup/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'

export type LoadRaceOptions = {
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
}

// The routes chosen so far (null for a racer without one) and the table position after their draws.
export type RouteDraws = {
  readonly routes: readonly (ComputerRacerRoute | null)[]
  readonly position: RandomTablePosition
}

export type RouteFiles = {
  readonly folder: string
  readonly readFile: (path: string) => Uint8Array
  readonly getIsPresent: (path: string) => boolean
}

// Reads a file of the archive by its full path.
export type ReadFile = (path: string) => Uint8Array

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
}

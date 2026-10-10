import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import type { RandomDraw, RandomTablePosition } from '../../../random-table/index.ts'

export type LoadRaceOptions = {
  // The race's folder below GAMEDATA; the first race is RACEC0R0.
  readonly raceFolder?: string
  // Game settings +0x100: racer 0 is the player, the others are computer racers.
  readonly racerCount?: number
  // Game settings +0x20.
  readonly raceModeFlags?: number
  // Game settings +0x32c.
  readonly localPlayerCount?: number
  // The random table position (0x004c6ee4) when the race loads; the menus advance it before.
  readonly randomPosition?: number
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

export type RouteDrawer = (position: RandomTablePosition) => RandomDraw

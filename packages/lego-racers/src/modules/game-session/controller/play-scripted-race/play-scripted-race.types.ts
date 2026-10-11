import type { RaceState } from '../../../race/index.ts'
import type { GameSession } from '../../types/game-session.types.ts'

export type RacerLapScript = {
  readonly racerIndex: number
  // The milliseconds since the racing state began (the clock goes on through the finishing state) at which the
  // racer crosses the line at the end of each lap.
  readonly lapEndMilliseconds: readonly number[]
}

export type ScriptedRaceOptions = {
  readonly frameMilliseconds?: number
  readonly maximumFrameCount?: number
}

export type ScriptedRaceResult = {
  readonly session: GameSession
  readonly raceState: RaceState
  readonly frameCount: number
  // The race stopped at a menu that waits for an answer (a race with a ghost, 9.5 s after the human finished).
  readonly isHeldForMenu: boolean
}

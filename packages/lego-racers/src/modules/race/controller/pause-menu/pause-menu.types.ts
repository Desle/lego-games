import type { RaceEvent, RaceState } from '../../types/race.types.ts'

// What the menu did to the race in one call: the state, and the events it raised.
export type PauseMenuStep = {
  readonly raceState: RaceState
  readonly events: readonly RaceEvent[]
}

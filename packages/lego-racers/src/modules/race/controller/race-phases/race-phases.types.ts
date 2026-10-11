import type { RaceEvent, RaceRacerSet, RaceState, RaceStepResult } from '../../types/race.types.ts'

// The loop over the racers in Race_UpdateState3: the result so far, and whether a human finished.
export type FinishingProgress = {
  readonly step: RaceStepResult
  readonly isFinishing: boolean
}

export type PhaseChange = {
  readonly raceState: RaceState
  readonly event: RaceEvent
}

export type RaceWorldChanger = (racerSet: RaceRacerSet) => RaceRacerSet

export type TuneChange = {
  readonly raceState: RaceState
  readonly events: readonly RaceEvent[]
}

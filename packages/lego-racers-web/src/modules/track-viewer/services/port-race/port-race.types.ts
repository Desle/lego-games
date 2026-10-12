import type { RaceState } from '@lego-games/lego-racers/race'
import type {
  GhostCar,
  RacePresentation,
  RacePresentationFrame,
} from '@lego-games/lego-racers/race-presentation'
import type { RaceStageSize } from '../race-viewport/race-viewport.types.ts'

// One frame of a headless race: the state after the step and what the presentation made of it.
export type PortRaceFrame = {
  readonly frame: number
  readonly milliseconds: number
  readonly raceState: RaceState
  readonly presentation: RacePresentationFrame
  // The ghost cars of a time trial as the draw's update (0x00435a00) leaves them; none in any other race.
  readonly ghostCars: readonly GhostCar[]
}

// The start of a headless race: the state before the first step and the introduction music.
export type PortRaceStart = {
  readonly raceState: RaceState
  readonly presentation: RacePresentation
  readonly musicListIndex: number
  readonly stageSize: RaceStageSize
}

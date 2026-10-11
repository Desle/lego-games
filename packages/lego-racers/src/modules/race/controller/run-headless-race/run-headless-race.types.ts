import type { Vector3 } from '../../../simulation-math/index.ts'
import type { RaceEvent, RaceExit, RacePhase, RaceState } from '../../types/race.types.ts'

export type HeadlessRaceOptions = {
  readonly frameCount: number
  // Fixed milliseconds of every frame; the original's frame clock gives 12..100.
  readonly frameMilliseconds: number
}

// What one racer shows after the run.
export type HeadlessRacerReport = {
  readonly racerIndex: number
  readonly controllerKind: number
  readonly position: Vector3
  readonly speed: number
  readonly groundedWheelCount: number
  // The route follower's playback time and sample index; null for a racer without a route.
  readonly routeTimeMilliseconds: number | null
  readonly routeSampleIndex: number | null
  readonly checkpointIndex: number
  // Race +0xd18: the laps counted by the checkpoint at the start line (-1 before the first line).
  readonly lap: number
  // Racer +0xce4: the laps completed, counted by the start line zone (the race ends a racer's laps at the lap count).
  readonly currentLap: number
  readonly racePosition: number
  // Racer flag 0x1000: the racer has been given its final place.
  readonly isPlaced: boolean
}

export type HeadlessRaceReport = {
  readonly frameCount: number
  readonly elapsedMilliseconds: number
  readonly phase: RacePhase
  readonly phaseMilliseconds: number
  readonly randomPosition: number
  readonly racers: readonly HeadlessRacerReport[]
  // Race +0x3330 and the final place of each racer (settings +0x15e + 0x5c·i).
  readonly finishedRacerCount: number
  readonly placements: readonly number[]
  readonly exit: RaceExit
  readonly events: readonly RaceEvent[]
  readonly raceState: RaceState
}

import type { Vector3 } from '../../../simulation-math/index.ts'
import type { RaceEvent, RacePhase, RaceState } from '../../types/race.types.ts'

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
  readonly lap: number
  readonly racePosition: number
}

export type HeadlessRaceReport = {
  readonly frameCount: number
  readonly elapsedMilliseconds: number
  readonly phase: RacePhase
  readonly phaseMilliseconds: number
  readonly randomPosition: number
  readonly racers: readonly HeadlessRacerReport[]
  readonly events: readonly RaceEvent[]
  readonly raceState: RaceState
}

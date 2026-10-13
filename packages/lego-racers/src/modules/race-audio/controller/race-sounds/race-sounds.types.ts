import type { Vector3 } from '../../../simulation-math/index.ts'
import type { TrackSoundParameters } from '../../../track-logic/index.ts'

// A position as the event and hazard modules give it.
export type PositionTriple = readonly [number, number, number]

// A track event's sound: where it plays and what it asks of the sound object.
export type TrackSoundPlacement = TrackSoundParameters & {
  readonly position: PositionTriple
}

// Where the race's sounds take their positions from: the racers (the original passes the racer's position to
// RaceSounds_PlayAt 0x00443b80).
export type RaceSoundContext = {
  readonly getRacerPosition: (racerIndex: number) => Vector3 | null
  // The human racers have sound objects for the turbo's and the warp's hum (0x00437540); the computers have none.
  readonly getHasSoundObjects: (racerIndex: number) => boolean
}

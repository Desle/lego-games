import type { Vector3 } from '../../../simulation-math/index.ts'

// What 0x0043c1b0 reads of a racer to pick the one that is heard: its position (racer +0x5c), velocity (+0x3f0), speed
// (+0x9ec), engine sound value (+0xd54) and how long it has been airborne (+0xd50).
export type NearestRacerCandidate = {
  readonly racerIndex: number
  readonly position: Vector3
  readonly velocity: Vector3
  readonly speed: number
  readonly engineSoundValue: number
  readonly airborneMilliseconds: number
}

// The racer the camera's racer hears and how the sound object is set (position, velocity doubled, pitch at +0x08).
export type NearestRacerSound = {
  readonly racerIndex: number
  readonly position: Vector3
  readonly velocity: Vector3
  readonly pitch: number
}

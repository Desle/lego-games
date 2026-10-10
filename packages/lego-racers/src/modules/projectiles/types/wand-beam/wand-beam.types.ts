import type { Vector3 } from '../../../simulation-math/index.ts'

// The sphere 0x0043fdc0 tests: the racer's frame +0x3c position and radius (+0x10).
export type WandBounds = {
  readonly center: Vector3
  readonly radius: number
}

export type WandBeamRequest = {
  // Muzzle frame (racer +0xe08): the position (+0x00..+0x08) and the direction (+0x18..+0x20).
  readonly muzzlePosition: Vector3
  readonly muzzleDirection: Vector3
  // Effect state 2 (the beam grows in) or 4 (it fades out); both count their 500 ms timer down.
  readonly isStarting: boolean
  readonly isEnding: boolean
  readonly timerMilliseconds: number
  // The racer the wand holds (effect +0x28), whose sphere the beam bends to.
  readonly struck: WandBounds | null
}

export type WandBeam = {
  // The first point of every segment: 3 above the muzzle.
  readonly origin: Vector3
  // +0x230: the length of one segment.
  readonly length: number
  // +0x1a0..: the four points, each one segment further along the direction.
  readonly points: readonly Vector3[]
}

import type { Vector3 } from '../../../simulation-math/index.ts'
import type {
  BallisticFlight,
  BallisticFlightState,
} from '../ballistic-flight/ballistic-flight.types.ts'

// The rocket's body (class 0x00423590, vtable 0x004b0248): a ballistic flight that steers at a racer, or follows the
// route 6 units above the ground, with a corkscrew wobble.
export type HomingFlight = {
  // The ballistic part: +0x04..+0x64 and the racers at +0x9c, +0xa0 and +0xa4. Its target position (+0x1c) follows the
  // target racer, and its launch velocity gives the homing speed near the target.
  readonly flight: BallisticFlight
  // +0xa8..+0xb0: the guided position, without the wobble.
  readonly position: Vector3
  // +0xb4 (it grows 6 a second), +0xb8 and +0xbc, +0xc0: the wobble's amplitude, its largest amplitude, its angle and
  // its angular speed.
  readonly wobbleAmplitude: number
  readonly wobbleMaximumAmplitude: number
  readonly wobbleAngle: number
  readonly wobbleRate: number
  // +0xc4..+0xcc: the velocity (0x00423ea0 reads it).
  readonly velocity: Vector3
  // +0xd0..+0xd8: the direction it flies in.
  readonly heading: Vector3
  // +0xdc..+0xe4 and +0xe8: the point on the ground below the route node it follows, once found.
  readonly groundPoint: Vector3
  readonly isGroundPointKnown: boolean
  // +0xec: the route node (an index) it follows, or null.
  readonly routeNodeIndex: number | null
  // +0xf0: milliseconds since the target was last chosen.
  readonly retargetMilliseconds: number
}

export type HomingAdvance = {
  readonly homing: HomingFlight
  readonly result: BallisticFlightState
}

// What the retargeting (0x00423640) asks of each racer.
export type HomingTarget = {
  readonly position: Vector3
  // Racer +0xaa8 & 0x80.
  readonly isStruckByLightning: boolean
  // Racer +0xd04 & 0x11: shielded or warping.
  readonly isShieldedOrWarping: boolean
}

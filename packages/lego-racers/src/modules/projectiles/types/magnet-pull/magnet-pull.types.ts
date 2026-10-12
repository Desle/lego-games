import type { Vector3 } from '../../../simulation-math/index.ts'
import type { ProjectileEvent } from '../projectile-event/projectile-event.types.ts'
import type { FlightRacer } from '../projectiles.types.ts'
import type { MagnetMotion } from '../projectile-world/projectile-world.types.ts'

// A racer as the magnet sees it: the flight fields plus the status flags of racer +0xd04 and +0xc84.
export type MagnetPullRacer = {
  readonly flight: FlightRacer
  // +0xd04 & 0x8.
  readonly isTumbling: boolean
  // +0xc84 & 0x1.
  readonly isInTurbo: boolean
}

export type MagnetPull = {
  readonly motion: MagnetMotion
  // The effect's timer after the pull (a captured, slowed racer caps it at 1000 ms).
  readonly timerMilliseconds: number
  readonly events: readonly ProjectileEvent[]
  // 0x0045b690 and 0x00439730 end this racer's turbo.
  readonly turboEndedRacer: number | null
}

// Where 0x00456360 puts a hazard: the ground point 1 up (the position itself on a miss) and the normal of the triangle it
// hit, or null on a miss.
export type HazardLanding = {
  readonly position: Vector3
  readonly normal: Vector3 | null
}

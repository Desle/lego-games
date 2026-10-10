import type { PowerUpStep } from '../../../power-ups/index.ts'
import type { BallisticFlight } from '../../types/ballistic-flight/ballistic-flight.types.ts'
import type { BallisticLaunchParameters } from '../../types/ballistic-flight/ballistic-flight.types.ts'

// A point along the owner's forward axis.
export type AheadPoint = {
  readonly distance: number
  readonly height: number
  // The product of distance and forward axis is stored before it is added to the position.
  readonly isProductStored: boolean
}

export type OwnerFlightRequest = {
  readonly parameters: BallisticLaunchParameters
  readonly ahead: AheadPoint
  readonly isLeadLimited: boolean
}

// What an exploding projectile's flight turned into (hit, turned round by a shield, or ended).
export type ResolvedProjectile = {
  readonly step: PowerUpStep
  readonly flight: BallisticFlight
}

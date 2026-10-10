import type { PowerUpContext, PowerUpStep } from '../../../power-ups/index.ts'
import type { BallisticFlight } from '../ballistic-flight/ballistic-flight.types.ts'
import type { FlightRacer, LineProbe } from '../projectiles.types.ts'

// The movement state of one pooled effect: the body the original keeps inside the effect object.
export type EffectMotion = {
  readonly kind: 'ballistic'
  // Cannon +0x30 and barrel +0xbc.
  readonly flight: BallisticFlight
}

// Everything the projectiles keep between frames, beside the power-ups' own state.
export type ProjectileWorld = {
  // Indexed by effect id; null until the effect has launched.
  readonly motions: readonly (EffectMotion | null)[]
}

export type ProjectileContext = {
  readonly powerUps: PowerUpContext
  // Indexed like powerUps.racers.
  readonly racers: readonly FlightRacer[]
  readonly probe: LineProbe
}

export type ProjectileStep = {
  readonly step: PowerUpStep
  readonly world: ProjectileWorld
}

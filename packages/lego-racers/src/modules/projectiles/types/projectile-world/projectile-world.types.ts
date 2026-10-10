import type { PowerUpContext, PowerUpStep } from '../../../power-ups/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { ProjectileEvent } from '../../events/projectile.events.types.ts'
import type { BallisticFlight } from '../ballistic-flight/ballistic-flight.types.ts'
import type { GrappleHook } from '../grapple-hook/grapple-hook.types.ts'
import type { FlightRacer, LineProbe } from '../projectiles.types.ts'

// The movement state of one pooled effect: the body the original keeps inside the effect object.
export type BallisticMotion = {
  readonly kind: 'ballistic'
  // Cannon +0x30 and barrel +0xbc.
  readonly flight: BallisticFlight
}

// The magnet (0x00455b40): its place on the ground and the racers near it.
export type MagnetMotion = {
  readonly kind: 'magnet'
  // The attachment frame's position (slot 4 of the object at +0x3c): the ground point 30 up.
  readonly position: Vector3
  // +0x7c: a racer that touched the magnet outside its capture range, pulled once.
  readonly candidateRacer: number | null
  // +0x80 bit 0: the captured racer has stopped.
  readonly isRacerStopped: boolean
  // +0x80 bit 1: the captured racer has been pulled to the magnet.
  readonly isRacerArrived: boolean
}

// The grapple (0x00453ef0): the hook is a ballistic flight with a rope.
export type GrappleMotion = {
  readonly kind: 'grapple'
  readonly hook: GrappleHook
}

export type EffectMotion = BallisticMotion | GrappleMotion | MagnetMotion

// Everything the projectiles keep between frames, beside the power-ups' own state.
export type ProjectileWorld = {
  // Indexed by effect id; null until the effect has launched.
  readonly motions: readonly (EffectMotion | null)[]
  // The events of the update in progress; updatePowerUpsWithProjectiles starts them empty.
  readonly events: readonly ProjectileEvent[]
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

// A racer the collision registry (0x0043d270) paired with a projectile or hazard effect.
export type ProjectileContact = {
  readonly effect: number
  readonly racer: number
}

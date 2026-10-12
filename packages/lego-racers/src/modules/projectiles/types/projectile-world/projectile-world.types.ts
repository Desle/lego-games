import type { PowerUpContext, PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import type { ProjectileEvent } from '../projectile-event/projectile-event.types.ts'
import type { BallisticFlight } from '../ballistic-flight/ballistic-flight.types.ts'
import type { HomingFlight } from '../homing-flight/homing-flight.types.ts'
import type { DebrisAnimations, DebrisPool } from '../debris/debris.types.ts'
import type { ExplosionPool } from '../explosion/explosion.types.ts'
import type { GrappleHook } from '../grapple-hook/grapple-hook.types.ts'
import type { RouteNode } from '../route-movement/route-movement.types.ts'
import type { WandBeam } from '../wand-beam/wand-beam.types.ts'
import type { FlightRacer, LineProbe, RocketLaunchBone } from '../projectiles.types.ts'

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

// The wand (0x00454d70): the beam it drew on the last update.
export type WandMotion = {
  readonly kind: 'wand'
  readonly beam: WandBeam
}

// The rocket (0x004568f0): its launch animation, then its homing body.
export type RocketMotion = {
  readonly kind: 'rocket'
  // The racer and rocket the body belongs to: a stolen effect (0x0045b2e0) restarts in place, and the new use does not
  // inherit the old body.
  readonly ownerRacer: number
  readonly rocketIndex: number
  // Milliseconds of the launch animation played so far (state 2).
  readonly launchElapsedMilliseconds: number
  // The missile figure's frame: the owner's display frame while the launch animation plays, then the one 0x00456db0
  // builds from the launch bone, whose first axis follows the heading and whose third axis it keeps.
  readonly framePosition: Vector3
  readonly frameRotation: Matrix3
  readonly homing: HomingFlight | null
}

// The oil slick and the curse (0x004573a0, 0x00452ae0): the ground point under the racer, 1 up, where their sphere sits.
export type HazardMotion = {
  readonly kind: 'hazard'
  readonly position: Vector3
}

export type EffectMotion =
  BallisticMotion | GrappleMotion | HazardMotion | MagnetMotion | RocketMotion | WandMotion

// Everything the projectiles keep between frames, beside the power-ups' own state.
export type ProjectileWorld = {
  // Indexed by effect id; null until the effect has launched.
  readonly motions: readonly (EffectMotion | null)[]
  // Indexed by effect id: the rocket body's wobble angle (+0xbc), which 0x00423980 does not reset, so a rocket that takes
  // over an effect continues the angle of the one before it.
  readonly rocketWobbleAngles: readonly number[]
  // The events of the update in progress; updatePowerUpsWithProjectiles starts them empty.
  readonly events: readonly ProjectileEvent[]
  // The explosions of power-up system +0x193c ("Explsn") and +0x1940 ("spikexp"), and the debris at +0x18bc.
  readonly explosions: ExplosionPool
  readonly spikedExplosions: ExplosionPool
  readonly debris: DebrisPool
}

export type ProjectileContext = {
  readonly powerUps: PowerUpContext
  // Indexed like powerUps.racers.
  readonly racers: readonly FlightRacer[]
  // The race's route (racer set +0x10), the nodes a warping racer follows.
  readonly route: readonly RouteNode[]
  // How long each rocket's launch animation lasts (model data the port does not read): rocket 0, 1 and 2.
  readonly rocketLaunchMilliseconds: readonly number[]
  // The launch bone of each rocket's clip and the missile model's scale (model +0x38): 0x00456db0 places the launched
  // rocket's frame with them.
  readonly rocketLaunchBones: readonly RocketLaunchBone[]
  readonly rocketModelScale: number
  // The lengths of the debris animations (model data the port does not read).
  readonly debrisAnimations: DebrisAnimations
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

// A racer the collision registry paired with an explosion.
export type ExplosionContact = {
  readonly isSpiked: boolean
  readonly explosion: number
  readonly racer: number
}

// One class's slot 2 (0x00451b50 and its siblings): the countdown and the movement of an active effect.
export type EffectUpdate = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
) => ProjectileStep

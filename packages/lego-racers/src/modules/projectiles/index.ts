export {
  MissingProjectileOwnerError,
  UnknownProjectileRacerError,
} from './controller/ballistic-effects/ballistic-effects.ts'
export {
  touchProjectileExplosions,
  touchProjectileFlights,
  touchProjectileHazards,
} from './controller/projectile-touch/projectile-touch.ts'
export {
  updatePowerUpsWithProjectiles,
  updateProjectileEffect,
} from './controller/projectile-update/projectile-update.ts'
export type { ProjectileEvent } from './types/projectile-event/projectile-event.types.ts'
export {
  advanceBallisticFlight,
  BallisticFlightState,
  createBallisticFlight,
  getFlightVelocity,
  getFlightWithVelocity,
  launchFlightAtPoint,
  launchFlightAtRacer,
  launchFlightWithOffset,
  reflectBallisticFlight,
  touchBallisticFlight,
} from './types/ballistic-flight/ballistic-flight.ts'
export type {
  BallisticFlight,
  BallisticFlightAdvance,
  BallisticLaunchParameters,
} from './types/ballistic-flight/ballistic-flight.types.ts'
export {
  getRegistryContacts,
  getSortedRegistryEntries,
} from './types/collision-registry/collision-registry.ts'
export type {
  RegistryContact,
  RegistryEntry,
  RegistryRacer,
  RegistryResult,
} from './types/collision-registry/collision-registry.types.ts'
export { createDebrisPool, DebrisState } from './types/debris/debris.ts'
export type { DebrisAnimations, DebrisPiece, DebrisPool } from './types/debris/debris.types.ts'
export {
  createExplosionPool,
  ExplosionState,
  getBlastImpulse,
  getThrowImpulse,
} from './types/explosion/explosion.ts'
export type {
  BlastTarget,
  Explosion,
  ExplosionParameters,
  ExplosionPool,
} from './types/explosion/explosion.types.ts'
export { advanceGrappleHook, getPointMovedToward } from './types/grapple-hook/grapple-hook.ts'
export type { GrappleHook } from './types/grapple-hook/grapple-hook.types.ts'
export { advanceHomingFlight, retargetHomingFlight } from './types/homing-flight/homing-flight.ts'
export type { HomingFlight, HomingTarget } from './types/homing-flight/homing-flight.types.ts'
export { getIsWithinMagnetCaptureRange, getMagnetPull } from './types/magnet-pull/magnet-pull.ts'
export { createProjectileWorld } from './types/projectile-world/projectile-world.ts'
export type {
  EffectMotion,
  ExplosionContact,
  ProjectileContact,
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from './types/projectile-world/projectile-world.types.ts'
export type { FlightRacer, LineProbe, LineProbeHit } from './types/projectiles.types.ts'
export {
  getPointMovedAlongRoute,
  getWarpLandingPosition,
} from './types/route-movement/route-movement.ts'
export type { RouteNode } from './types/route-movement/route-movement.types.ts'
export { createTrackLineProbe } from './types/track-line-probe/track-line-probe.ts'
export { getIsSpeedNearZero } from './types/turbo-early-end/turbo-early-end.ts'
export { getRaySphereHit, getWandBeam } from './types/wand-beam/wand-beam.ts'
export type { WandBeam, WandBeamRequest, WandBounds } from './types/wand-beam/wand-beam.types.ts'

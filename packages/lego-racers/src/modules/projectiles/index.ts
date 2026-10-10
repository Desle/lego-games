export {
  updatePowerUpsWithProjectiles,
  updateProjectileEffect,
} from './controller/projectile-update/projectile-update.ts'
export {
  MissingProjectileOwnerError,
  UnknownProjectileRacerError,
} from './controller/ballistic-effects/ballistic-effects.ts'
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
export { createProjectileWorld } from './types/projectile-world/projectile-world.ts'
export type {
  EffectMotion,
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from './types/projectile-world/projectile-world.types.ts'
export type { FlightRacer, LineProbe, LineProbeHit } from './types/projectiles.types.ts'
export { createTrackLineProbe } from './types/track-line-probe/track-line-probe.ts'

import type { ProjectileModelData } from '../race.types.ts'

// The route, rocket and debris model data the port does not read from the JAM yet: no route, zero-length animations.
export const EMPTY_PROJECTILE_MODEL_DATA: ProjectileModelData = Object.freeze({
  routeNodes: Object.freeze([]),
  rocketLaunchMilliseconds: Object.freeze([0, 0, 0]),
  debrisAnimations: Object.freeze([[0], [0], [0], [0]]),
})

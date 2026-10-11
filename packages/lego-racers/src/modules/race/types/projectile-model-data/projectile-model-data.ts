import type { ProjectileModelData } from '../race.types.ts'

// The route, rocket and debris model data the port does not read from the JAM yet: no route, zero-length animations.
const NO_BOUNDS = Object.freeze({ centre: Object.freeze({ x: 0, y: 0, z: 0 }), radius: 0 })

export const EMPTY_PROJECTILE_MODEL_DATA: ProjectileModelData = Object.freeze({
  shapeBounds: Object.freeze({ grapple: NO_BOUNDS, barrel: NO_BOUNDS, rocket: NO_BOUNDS }),
  routeNodes: Object.freeze([]),
  rocketLaunchMilliseconds: Object.freeze([0, 0, 0]),
  debrisAnimations: Object.freeze([[0], [0], [0], [0]]),
})

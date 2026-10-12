import type { RocketLaunchBone } from '../../../projectiles/index.ts'
import type { ProjectileModelData } from '../race.types.ts'

// The route, rocket and debris model data the port does not read from the JAM yet: no route, zero-length animations.
const NO_BOUNDS = Object.freeze({ centre: Object.freeze({ x: 0, y: 0, z: 0 }), radius: 0 })

// The identity: a rocket launches from the owner's frame, along its first axis.
const NO_LAUNCH_BONE: RocketLaunchBone = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  firstAxis: Object.freeze({ x: 1, y: 0, z: 0 }),
  thirdAxis: Object.freeze({ x: 0, y: 0, z: 1 }),
})

export const EMPTY_PROJECTILE_MODEL_DATA: ProjectileModelData = Object.freeze({
  shapeBounds: Object.freeze({ grapple: NO_BOUNDS, barrel: NO_BOUNDS, rocket: NO_BOUNDS }),
  routeNodes: Object.freeze([]),
  rocketLaunchMilliseconds: Object.freeze([0, 0, 0]),
  rocketLaunchBones: Object.freeze([NO_LAUNCH_BONE, NO_LAUNCH_BONE, NO_LAUNCH_BONE]),
  rocketModelScale: 1,
  debrisAnimations: Object.freeze([[0], [0], [0], [0]]),
})

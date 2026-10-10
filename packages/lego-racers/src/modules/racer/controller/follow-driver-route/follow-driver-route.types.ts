import type { Vector3 } from '../../../simulation-math/index.ts'

// The vector from the car to the route target, and its length unrounded (as compared) and stored.
export type TargetOffset = {
  readonly offset: Vector3
  readonly distanceRaw: number
  readonly distance: number
}

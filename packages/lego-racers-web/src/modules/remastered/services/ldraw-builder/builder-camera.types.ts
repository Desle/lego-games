import type { Vector } from './ldraw-builder.types.ts'

// The build view's camera about the point it looks at, in the world's axes (z up): turned about z, tilted up from the ground.
export type BuilderView = {
  readonly target: Vector
  readonly azimuth: number
  readonly elevation: number
  readonly distance: number
}

// The camera's right and the way it looks, flattened onto the ground (z = 0) and of length one.
export type BuilderGroundAxes = {
  readonly right: Vector
  readonly forward: Vector
}

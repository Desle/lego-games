import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { ModelObject } from '../model-object/model-object.types.ts'

// A car's drawing from a viewer extension, following the car's parts as the viewer positions them.
export type CarLink = {
  // The parts to use in place of the given ones: their original meshes are hidden and the animation states the viewer gives them are
  // remembered for the drawing. Disposing the wheels also disposes the drawing.
  readonly wheels: ModelObject
  readonly body: ModelObject | null
  // Hands the drawing where the parts are now (their groups' matrices and visibility, their animation states).
  readonly sync: (opacity?: number) => void
}

export type DriverLink = {
  readonly driver: ModelObject
  readonly sync: (opacity?: number) => void
}

// The wheels and the body of a car the viewer positions every frame (the body is null for a car with no model of its own).
export type CarParts = {
  readonly wheels: ModelObject
  readonly body: ModelObject | null
}

// Where the animation state the viewer gave a part is kept for the drawing.
export type StateHolder = {
  readonly get: () => SkeletonAnimationState | null
  readonly set: (state: SkeletonAnimationState) => void
}

import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { RacerPartPose } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
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

// A drawing that stands in for a model the viewer does not move itself (a cinema world's instance): `sync` hands it where the
// model is now (its frame in the host's, whether it shows, its skeleton's state).
export type FollowedDrawing = {
  readonly sync: (pose: RacerPartPose) => void
  readonly dispose: () => void
}

// Hides the original's meshes the drawing stands in for (true) or shows them again (false: the drawing failed or went).
export type OriginalVisibility = (isHidden: boolean) => void

// Where the animation state the viewer gave a part is kept for the drawing.
export type StateHolder = {
  readonly get: () => SkeletonAnimationState | null
  readonly set: (state: SkeletonAnimationState) => void
}

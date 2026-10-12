import type { EffectViews, RacerPose } from '@lego-games/lego-racers/race-presentation'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'

// The effects of a race as three.js objects.
export type RaceEffects = {
  // Shows the effects the race reports this frame and hides the rest.
  // The bricks farther from the eye than their level distance are left out.
  readonly update: (views: EffectViews, eye: Vector3Like, poses: readonly RacerPose[]) => void
  readonly dispose: () => void
}

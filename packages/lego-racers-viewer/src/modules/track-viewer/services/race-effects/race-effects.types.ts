import type { EffectViews } from '@lego-games/lego-racers/race-presentation'

// The effects of a race as three.js objects.
export type RaceEffects = {
  // Shows the effects the race reports this frame and hides the rest.
  readonly update: (views: EffectViews) => void
  readonly dispose: () => void
}

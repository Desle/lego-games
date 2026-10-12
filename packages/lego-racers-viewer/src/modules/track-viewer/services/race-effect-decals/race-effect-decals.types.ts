import type { DecalView } from '@lego-games/lego-racers/race-presentation'

export type RaceEffectDecals = {
  // Shows the decals the effects hold this frame and hides the rest.
  readonly update: (views: readonly DecalView[]) => void
  readonly dispose: () => void
}

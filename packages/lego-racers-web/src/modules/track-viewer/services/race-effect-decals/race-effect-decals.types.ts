import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'
import type { DecalView } from '@lego-games/lego-racers/race-presentation'

export type RaceEffectDecals = {
  // Shows the decals the effects hold this frame and hides the rest.
  readonly update: (views: readonly DecalView[], eye: Vector3Like) => void
  readonly dispose: () => void
}

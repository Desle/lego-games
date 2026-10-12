import type { DecalWorld } from '@lego-games/lego-racers/decal'
import type { RacerPose } from '@lego-games/lego-racers/race-presentation'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'

// What decals are projected onto.
export type DecalSurface = {
  readonly world: DecalWorld
}

export type RaceDecals = {
  // Projects every racer's shadow for the camera at `eye`.
  readonly update: (poses: readonly RacerPose[], eye: Vector3Like) => void
  readonly dispose: () => void
}

import type { DecalWorld } from '@lego-games/lego-racers/decal'
import type { DecalView, RacerPose } from '@lego-games/lego-racers/race-presentation'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'

// What decals are projected onto.
export type DecalSurface = {
  readonly world: DecalWorld
}

export type RaceDecals = {
  // Projects every racer's shadow for the camera at `eye`.
  readonly update: (poses: readonly RacerPose[], eye: Vector3Like) => void
  // Projects the decals the effects lay on the track (oil slicks, explosion scars, crane shadows).
  readonly updateEffects: (views: readonly DecalView[], eye: Vector3Like) => void
  // Hands the simulation step's racers to their skid trails.
  readonly setPoses: (poses: readonly RacerPose[]) => void
  // The end of the frame: the skid trails take the milliseconds.
  readonly step: (elapsedMilliseconds: number) => void
  readonly dispose: () => void
}

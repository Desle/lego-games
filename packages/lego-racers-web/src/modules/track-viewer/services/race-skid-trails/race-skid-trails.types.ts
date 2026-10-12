import type { RacerPose } from '@lego-games/lego-racers/race-presentation'
import type { Mesh } from 'three'

// The trail each wheel of a racer holds (vehicle +0x1e4..), by its index in the pool.
export type TrailHandles = {
  readonly trailIndices: (number | null)[]
}

export type RaceSkidTrails = {
  // Hands the racers of one simulation step to their trails, in racer order.
  readonly setPoses: (poses: readonly RacerPose[]) => void
  // The end of the frame: the trails take the milliseconds (0x00492870) and are shown.
  readonly step: (elapsedMilliseconds: number) => void
  readonly dispose: () => void
}

// The mesh that holds the marks drawn with one image, with that image's alpha.
export type ImageMesh = {
  readonly mesh: Mesh
  readonly alpha: number
}

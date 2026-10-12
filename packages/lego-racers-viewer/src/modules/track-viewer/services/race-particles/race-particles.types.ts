import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type { Group, Mesh } from 'three'

export type RaceParticles = {
  readonly group: Group
  // Builds the quads of the live particles of the pools for the camera; with the pixels one unit spans at depth 1 of the
  // original's 640 x 480 surface it leaves out the quads the engine does not submit (too small), without it none.
  readonly update: (
    pools: readonly (EmitterPool | null)[],
    cameraView: CameraView,
    focalLengthPixels: number | null
  ) => void
  readonly dispose: () => void
}

// The mesh that holds the quads of one material, with the colour of the material.
export type MaterialBatch = {
  readonly mesh: Mesh
  readonly color: readonly [number, number, number, number]
}

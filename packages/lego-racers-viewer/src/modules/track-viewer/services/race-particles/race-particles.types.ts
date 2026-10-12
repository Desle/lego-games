import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type { Group, Mesh } from 'three'

export type RaceParticles = {
  readonly group: Group
  // Builds the quads of the live particles of the pools for the camera.
  readonly update: (pools: readonly (EmitterPool | null)[], cameraView: CameraView) => void
  readonly dispose: () => void
}

// The mesh that holds the quads of one material, with the colour of the material.
export type MaterialBatch = {
  readonly mesh: Mesh
  readonly color: readonly [number, number, number, number]
}

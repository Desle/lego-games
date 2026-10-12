import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import type { SpriteView } from '@lego-games/lego-racers/race-presentation'
import type { RibbonView } from '@lego-games/lego-racers/ribbon'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type { Group, Mesh } from 'three'

export type RaceParticles = {
  readonly group: Group
  // Builds the quads of the live particles of the pools for the camera.
  // The sprites the effects draw are camera-facing quads of the same kind.
  readonly update: (
    pools: readonly (EmitterPool | null)[],
    cameraView: CameraView,
    sprites?: readonly SpriteView[],
    // The strips of the effects (the grapple's rope, the wand's beam), in the world.
    ribbons?: readonly RibbonView[]
  ) => void
  readonly dispose: () => void
}

// The mesh that holds the quads of one material, with the colour of the material.
export type MaterialBatch = {
  readonly mesh: Mesh
  readonly color: readonly [number, number, number, number]
}

import type { EmitterPool, EmitterQuad } from '@lego-games/lego-racers/emitter'
import type { SpriteView } from '@lego-games/lego-racers/race-presentation'
import type { RibbonView } from '@lego-games/lego-racers/ribbon'
import type { TrailDrawing } from '@lego-games/lego-racers/projectile-trail'
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
    ribbons?: readonly RibbonView[],
    // The track world's sprites (trees, torches, lamps) for this camera, drawn like the effects' sprites.
    worldSpriteQuads?: readonly EmitterQuad[],
    // The streaks behind the cannonballs and rockets (the trail pool's meshes).
    trails?: readonly TrailDrawing[]
  ) => void
  readonly dispose: () => void
}

// The mesh that holds the quads of one material, with the colour of the material.
export type MaterialBatch = {
  readonly mesh: Mesh
  readonly color: readonly [number, number, number, number]
  // The material draws its texture alone (the vertices' colours are white).
  readonly isDiffuseWhite: boolean
}

// A corner written into a batch: its place in the world and its picture coordinates.
export type BatchCorner = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly u: number
  readonly v: number
}

// A quad to draw, with whether it is a world sprite (white vertices, the texture's rows in file order).
export type ParticleQuad = {
  readonly quad: EmitterQuad
  readonly isWorldSprite: boolean
}

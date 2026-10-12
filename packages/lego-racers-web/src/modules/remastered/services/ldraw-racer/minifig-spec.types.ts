import type { LDrawHat } from './ldraw-minifig-hats.types.ts'
import type { MinifigSurfaces } from './minifig-surfaces.types.ts'

// Which parts a driver is made of and how they look: the hat, and the colours and pictures the original paints the rest with.
export type MinifigSpec = {
  readonly partBytes: readonly number[]
  readonly hat: LDrawHat | null
  // The torso carries a hook for a hand, the legs a wooden peg.
  readonly isHookTorso: boolean
  readonly isPegLegs: boolean
  readonly surfaces: MinifigSurfaces
}

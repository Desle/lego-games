import type { LDrawHat, LDrawLegsMatch, LDrawTorsoPrint } from './ldraw-minifig-parts.types.ts'
import type { MinifigSurfaces } from './minifig-surfaces.types.ts'

// Which parts a driver is made of and how they look: the library's printed parts the catalogue entries stand for (a part left null
// is not matched: it keeps the game's picture), and the colours and pictures the original paints the rest with.
export type MinifigSpec = {
  readonly partBytes: readonly number[]
  readonly hats: readonly LDrawHat[]
  readonly face: LDrawHat | null
  readonly torso: LDrawTorsoPrint | null
  readonly legs: LDrawLegsMatch | null
  // The torso carries a hook for a hand.
  readonly isHookTorso: boolean
  readonly surfaces: MinifigSurfaces
}

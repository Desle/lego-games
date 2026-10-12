import type { DecalTriangle } from '@lego-games/lego-racers/decal'

// A decal the port holds in a frame: its picture and the triangles it projects.
export type PortDecal = {
  readonly imageName: string
  readonly triangles: readonly DecalTriangle[]
  // The alpha it is drawn with; null: opaque.
  readonly alpha: number | null
}

// One recorded frame: how many of the port's decals have an original with the same triangles, and which of the
// original's decals (the address its projection was called from, and its triangle count) have no port decal.
export type DecalFrameComparison = {
  readonly frame: number
  readonly portCount: number
  readonly matchedCount: number
  readonly unmatchedOriginals: readonly string[]
}

import type { CoverageBounds, RaceCoverage } from './render-coverage.types.ts'

// A texture the original draws, summed over the races: how much of it the port has no partner for.
export type CoverageRankedTexture = {
  readonly textureName: string
  readonly stateLabel: string
  readonly isTextureInPort: boolean
  // True when no port object in any race uses the texture: the port never draws it.
  readonly isNeverDrawnByPort: boolean
  readonly originalTriangles: number
  readonly missingTriangles: number
  readonly missingPixels: number
  readonly frameCount: number
  readonly races: readonly string[]
  readonly bounds: CoverageBounds | null
  readonly depthRange: readonly [number, number] | null
}

export type CoverageRankedExtra = {
  readonly source: string
  readonly textureName: string
  readonly triangles: number
  readonly frameCount: number
  readonly races: readonly string[]
}

export type CoverageRankedMismatch = {
  readonly kind: string
  readonly source: string
  readonly triangles: number
  readonly frameCount: number
  readonly races: readonly string[]
  readonly firstDetail: string
  readonly lastDetail: string
}

export type CoverageReport = {
  readonly races: readonly RaceCoverage[]
  readonly textures: readonly CoverageRankedTexture[]
  readonly extras: readonly CoverageRankedExtra[]
  readonly mismatches: readonly CoverageRankedMismatch[]
}

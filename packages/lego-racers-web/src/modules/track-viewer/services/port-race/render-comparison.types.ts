import type {
  DrawnTriangle,
  OriginalPresentation,
  OriginalRenderFrame,
  PortTexture,
  QuadComparison,
  RootComparison,
  RenderMismatchGroup,
  TextureMatch,
} from '@lego-games/lego-racers/presentation-trace'
import type { createRaceStage } from '../race-viewport/race-viewport.ts'
import type { PortRaceFrame } from './port-race.types.ts'
import type { PortTriangles } from './port-triangles.types.ts'

// One kind of mismatch of one object, over the recorded frames it appears in.
export type AggregatedGroup = Pick<RenderMismatchGroup, 'kind' | 'source' | 'firstDetail'> & {
  readonly frames: readonly number[]
  readonly count: number
}

export type FrameTotals = {
  readonly frame: number
  readonly originalCount: number
  readonly portCount: number
  readonly matchedCount: number
  // The largest distance (1/w) of a corner the original drew.
  readonly farthestOriginalDepth: number
}

// The HUD of one frame: the rectangles the original drew against the port's image commands.
export type HudFrameResult = QuadComparison & { readonly frame: number }

// How many triangles the original and the port drew of a watched drawing (TraceScenarioRequest.watched) in a frame.
export type WatchedCount = {
  readonly label: string
  readonly frame: number
  readonly originalCount: number
  readonly portCount: number
  // The mean of the port triangles' corners: it moves when the drawing turns.
  readonly portCentre: readonly [number, number, number]
}

export type RenderScenarioResult = {
  readonly watched: readonly WatchedCount[]
  readonly hudResults: readonly HudFrameResult[]
  readonly totals: readonly FrameTotals[]
  readonly groups: readonly AggregatedGroup[]
}

export type WorldFrameInput = {
  readonly stage: ReturnType<typeof createRaceStage>
  readonly portFrame: PortRaceFrame
  readonly original: OriginalPresentation
  readonly sceneTextures: ReadonlyMap<string, PortTexture>
  readonly candidateCount: number
}

export type WorldFrameComparison = {
  readonly originalFrame: OriginalRenderFrame
  readonly originalTriangles: readonly DrawnTriangle[]
  readonly portTriangles: PortTriangles
  readonly textureMatches: ReadonlyMap<string, TextureMatch>
  readonly comparison: RootComparison
}

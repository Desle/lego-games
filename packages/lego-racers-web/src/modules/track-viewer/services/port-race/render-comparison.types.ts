import type {
  QuadComparison,
  RenderMismatchGroup,
} from '@lego-games/lego-racers/presentation-trace'

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
}

export type RenderScenarioResult = {
  readonly watched: readonly WatchedCount[]
  readonly hudResults: readonly HudFrameResult[]
  readonly totals: readonly FrameTotals[]
  readonly groups: readonly AggregatedGroup[]
}

import type { RenderMismatchGroup } from '@lego-games/lego-racers/presentation-trace'

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
}

export type RenderScenarioResult = {
  readonly totals: readonly FrameTotals[]
  readonly groups: readonly AggregatedGroup[]
}

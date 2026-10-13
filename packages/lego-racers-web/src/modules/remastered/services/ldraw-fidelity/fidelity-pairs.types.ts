import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { BoundsPair } from './fidelity-anchors.types.ts'
import type { ChassisMeasurement } from './fidelity-metrics.types.ts'
import type { FidelityPair } from './fidelity-render.types.ts'
import type { FidelityAnchorResult } from './ldraw-fidelity.types.ts'

// An item's original and replacement, ready to draw, with the distances of its attachment points and what to free afterwards.
export type FidelityPairBuild = {
  readonly pair: FidelityPair
  readonly anchors: readonly FidelityAnchorResult[]
  // The region the views are framed on and the bounds compared (a catalogue part's), null for the whole of both.
  readonly focus: BoundsPair | null
  // A chassis recipe's own measures, which make its score; null for every other item.
  readonly chassis: ChassisMeasurement | null
  readonly note: string
  readonly dispose: () => void
}

// A build, or why there is none.
export type FidelityPairOutcome = FidelityPairBuild | string

export type FidelityContext = {
  readonly archive: JamArchive
}

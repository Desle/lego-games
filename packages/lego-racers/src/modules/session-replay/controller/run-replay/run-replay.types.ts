import type { FieldDivergence, TraceComparison } from '../../../golden-trace/index.ts'

export type ReplayReport = {
  readonly frameCount: number
  // The port's own run of the recording (the recorded car): the phase and random cursor after the last frame.
  readonly portPhase: string
  readonly portRandomPosition: number
  // The original beside the port (the champion car on both sides); null when it was not run.
  readonly original: {
    readonly comparedFrameCount: number
    // Why the original was not fed the frames after `comparedFrameCount`; null when it was fed all.
    readonly stopReason: string | null
    readonly comparison: TraceComparison
    readonly firstDivergence: FieldDivergence | null
  } | null
  // Why the original was not run at all.
  readonly originalSkipReason: string | null
}

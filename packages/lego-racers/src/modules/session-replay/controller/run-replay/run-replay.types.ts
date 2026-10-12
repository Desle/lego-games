import type { FieldDivergence, TraceComparison } from '../../../golden-trace/index.ts'
import type { ReplayControllerKind } from '../../../session-recording/index.ts'

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
    // What the original was fed: the controller, the frames with a pause-menu key, the frames with a gamepad in use.
    readonly controller: ReplayControllerKind
    readonly menuKeyFrameCount: number
    readonly gamepadFrameCount: number
    // Which car drives on both sides and why.
    readonly carNote: string
  } | null
  // Why the original was not run at all.
  readonly originalSkipReason: string | null
}

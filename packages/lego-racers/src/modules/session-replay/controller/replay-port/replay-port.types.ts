import type { TraceFrame } from '../../../golden-trace/index.ts'
import type { RaceState } from '../../../race/index.ts'

export type PortReplay = {
  readonly raceState: RaceState
  readonly frames: readonly TraceFrame[]
  // Whether a race menu (pause, results, confirmation) was open after each frame.
  readonly menuOpenFrames: readonly boolean[]
}

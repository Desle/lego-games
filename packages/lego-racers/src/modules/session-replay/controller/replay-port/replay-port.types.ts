import type { TraceFrame } from '../../../golden-trace/index.ts'
import type { RaceState } from '../../../race/index.ts'

export type PortReplay = {
  readonly raceState: RaceState
  readonly frames: readonly TraceFrame[]
}

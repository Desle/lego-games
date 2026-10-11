import type { SaveRacer } from '../save-data.types.ts'

export type CircuitRankUpdate = {
  readonly racer: SaveRacer
  readonly isRecorded: boolean
}

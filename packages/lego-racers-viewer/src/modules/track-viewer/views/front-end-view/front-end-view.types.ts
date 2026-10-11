import type {
  FrontEndMemory,
  FrontEndRaceRequest,
  FrontEndStandingRow,
} from '@lego-games/lego-racers/front-end'
import type { RandomTable } from '@lego-games/lego-racers/random-table'

export type FrontEndViewProps = {
  readonly jam: Uint8Array
  readonly randomTable: RandomTable
  readonly memory: FrontEndMemory
  // Reads a music file next to LEGO.JAM; null when the menus play no music.
  readonly readTune: ((name: string) => Promise<Uint8Array | null>) | null
  readonly width: number
  readonly height: number
  readonly firstScreenId: number
  readonly standingRows: readonly FrontEndStandingRow[]
  readonly onRaceRequested: (request: FrontEndRaceRequest) => void
  readonly onQuit: () => void
}

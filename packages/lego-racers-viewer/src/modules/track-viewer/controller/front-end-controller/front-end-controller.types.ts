import type {
  FrontEndDemonstrationRequest,
  FrontEndMemory,
  FrontEndRaceRequest,
  FrontEndStandingRow,
} from '@lego-games/lego-racers/front-end'
import type { RandomTable } from '@lego-games/lego-racers/random-table'
import type { RefObject } from 'react'

export type FrontEndControllerOptions = {
  // LEGO.JAM of the opened game.
  readonly jam: Uint8Array
  // The game's random table (the mix button of the driver editor draws from it) and what the last visit left.
  readonly randomTable: RandomTable
  readonly memory: FrontEndMemory
  // Reads a music file (e.g. `theme.tun`) next to LEGO.JAM; null plays no music.
  readonly readTune: ((name: string) => Promise<Uint8Array | null>) | null
  // The screen the menus open on, and the standings a circuit result screen lists.
  readonly firstScreenId: number
  readonly standingRows: readonly FrontEndStandingRow[]
  // The menus changed what they keep between visits (the car, the racer, the save file, the random position).
  readonly onMenuMemoryChanged: (memory: FrontEndMemory) => void
  // A race was chosen: what the menus left in the game settings.
  readonly onRaceRequested: (request: FrontEndRaceRequest) => void
  // The main menu waited for 60 seconds: the game starts a demonstration race.
  readonly onDemonstrationRequested: (request: FrontEndDemonstrationRequest) => void
  // The quit question was answered with yes.
  readonly onQuit: () => void
}

export type FrontEndController = {
  readonly canvasReference: RefObject<HTMLCanvasElement | null>
  readonly errorMessage: string | null
}

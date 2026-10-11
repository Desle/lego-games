import type { FrontEndRaceRequest, FrontEndStandingRow } from '@lego-games/lego-racers/front-end'
import type { RefObject } from 'react'

export type FrontEndControllerOptions = {
  // LEGO.JAM of the opened game.
  readonly jam: Uint8Array
  // Reads a music file (e.g. `theme.tun`) next to LEGO.JAM; null plays no music.
  readonly readTune: ((name: string) => Promise<Uint8Array | null>) | null
  // The screen the menus open on, and the standings a circuit result screen lists.
  readonly firstScreenId: number
  readonly standingRows: readonly FrontEndStandingRow[]
  // A race was chosen: what the menus left in the game settings.
  readonly onRaceRequested: (request: FrontEndRaceRequest) => void
  // The quit question was answered with yes.
  readonly onQuit: () => void
}

export type FrontEndController = {
  readonly canvasReference: RefObject<HTMLCanvasElement | null>
  readonly errorMessage: string | null
}

import type { LoadRaceOptions } from '@lego-games/lego-racers/race'
import type { RefObject } from 'react'

export type FrontEndControllerOptions = {
  // LEGO.JAM of the opened game.
  readonly jam: Uint8Array
  // A race was chosen: the options of the race loader the menus produced.
  readonly onRaceRequested: (options: LoadRaceOptions) => void
  // The quit question was answered with yes.
  readonly onQuit: () => void
}

export type FrontEndController = {
  readonly canvasReference: RefObject<HTMLCanvasElement | null>
  readonly errorMessage: string | null
}

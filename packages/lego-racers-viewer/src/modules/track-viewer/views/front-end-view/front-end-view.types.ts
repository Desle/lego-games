import type { LoadRaceOptions } from '@lego-games/lego-racers/race'

export type FrontEndViewProps = {
  readonly jam: Uint8Array
  readonly width: number
  readonly height: number
  readonly onRaceRequested: (options: LoadRaceOptions) => void
  readonly onQuit: () => void
}

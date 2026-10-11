import type { FrontEndRaceRequest, FrontEndStandingRow } from '@lego-games/lego-racers/front-end'

export type FrontEndViewProps = {
  readonly jam: Uint8Array
  readonly width: number
  readonly height: number
  readonly firstScreenId: number
  readonly standingRows: readonly FrontEndStandingRow[]
  readonly onRaceRequested: (request: FrontEndRaceRequest) => void
  readonly onQuit: () => void
}

import type { RacerShowcaseView } from '@lego-games/lego-racers/front-end'

// The racer showcase of the race select drawn into the menu world `RS_SET`: the racer's car on the turntable, his driver
// in his pose, and the turntable's clock on the shadows.
export type ShowcaseStage = {
  readonly show: (view: RacerShowcaseView) => void
  readonly dispose: () => void
}

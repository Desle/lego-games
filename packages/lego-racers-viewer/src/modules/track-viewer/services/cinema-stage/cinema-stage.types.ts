import type { RaceCinemaView } from '@lego-games/lego-racers/front-end'

// The race preview of the race selects drawn into the menu world `SINGRACE\PST`: the instances the cinema's actions show,
// each placed and (skeleton instances) in the clip the action names, at the cinema's clock.
export type CinemaStage = {
  readonly show: (view: RaceCinemaView) => void
}

export type UnitVector = { readonly x: number; readonly y: number; readonly z: number }

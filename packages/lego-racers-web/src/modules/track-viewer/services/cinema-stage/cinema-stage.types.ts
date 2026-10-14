import type { RaceCinemaView, WorldCamera } from '@lego-games/lego-racers/front-end'

// A cinema drawn into its menu world (the race previews of `SINGRACE\PST`, the full-screen cinemas of the award, win and
// introduction folders): the instances the cinema's actions show, each placed and (skeleton instances) in the clip the action
// names, at the cinema's clock; `show` gives the camera the world is seen from: the world's own, carried by the camera
// skeleton the cinema names. The champions' cars and figures among the instances are drawn by a viewer extension when it has a
// drawing for them (`cinema-racers`).
export type CinemaStage = {
  readonly show: (view: RaceCinemaView) => WorldCamera | null
  readonly dispose: () => void
}

export type UnitVector = { readonly x: number; readonly y: number; readonly z: number }

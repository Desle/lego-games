import { createFigure, playFigureAnimation } from '../../../racer/index.ts'
import type { Figure } from '../../../racer/index.ts'
import { getFigureAnimations } from '../get-figure-animations/get-figure-animations.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import {
  DRIVER_STARTING_ANIMATION,
  WHEELS_STARTING_ANIMATION,
} from '../../types/racer-appearance-names.ts'
import type {
  FigureSource,
  RacerFigureSources,
  RacerFigures,
} from '../../types/racer-appearance.types.ts'

// Figure flag 0x10000: the animation plays (set by 0x0043d7a0 after it starts each one).
const FIGURE_PLAYS_FLAG = 0x10000

// 0x0040d550 (the figure bound to a model, a skeleton and an animation set) followed by the animation 0x0043d7a0
// starts: 0x0040dad0 plays it from the start, looping, and the figure's flag 0x10000 is set. The model part's own
// sphere (0x100278c0, not ported) only matters while no animation plays, so the part keeps a point at the origin; its
// radius scale is the model's scale, which multiplies the animation's radius.
const getPlayingFigure = (source: FigureSource, animationId: number): Figure => {
  const animations = getFigureAnimations(source.animationBytes)
  const figure = createFigure(animations, {
    centre: ZERO_VECTOR3,
    radius: 0,
    radiusScale: source.modelScale,
  })
  const played = playFigureAnimation(figure, animationId)
  return Object.freeze({ ...played, flags: played.flags | FIGURE_PLAYS_FLAG })
}

// The racer's figures as Vehicle_Setup 0x0043d7a0 leaves them: the wheels (and the second chassis figure, if the
// chassis has one) in animation 0, the driver in animation 9.
export const createRacerFigures = (sources: RacerFigureSources): RacerFigures =>
  Object.freeze({
    bodyBounds: sources.bodyBounds,
    wheels: getPlayingFigure(sources.wheels, WHEELS_STARTING_ANIMATION),
    secondWheels:
      sources.secondWheels === null
        ? null
        : getPlayingFigure(sources.secondWheels, WHEELS_STARTING_ANIMATION),
    driver: getPlayingFigure(sources.driver, DRIVER_STARTING_ANIMATION),
  })

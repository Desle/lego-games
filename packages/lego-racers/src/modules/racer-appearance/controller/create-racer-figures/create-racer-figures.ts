import { parseAnimation } from '../../../animation/index.ts'
import type { AnimationKeyword2cEntry } from '../../../animation/index.ts'
import { createFigure, playFigureAnimation } from '../../../racer/index.ts'
import type { Figure, FigureAnimation } from '../../../racer/index.ts'
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

const UNSIGNED_SHORT_MASK = 0xffff
// Figure flag 0x10000: the animation plays (set by 0x0043d7a0 after it starts each one).
const FIGURE_PLAYS_FLAG = 0x10000

// One 40-byte entry of the ADB's keyword 0x2c is one record of the figure's animation set (figure +0xa8 → +0x2c):
// the rate at +0, the vector at +4, the bounding sphere at +0x10 (keyword 0x31's four values), the frame count at +0x24
// and the period at +0x26 (0x0040dae0, 0x0040e0b0).
const getFigureAnimation = (entry: AnimationKeyword2cEntry): FigureAnimation => {
  const [vectorX, vectorY, vectorZ] = entry.keyword30Values
  const [centreX, centreY, centreZ, radius] = entry.keyword31Values
  return Object.freeze({
    rate: entry.keyword2fValue,
    vector: Object.freeze({ x: vectorX, y: vectorY, z: vectorZ }),
    boundsCentre: Object.freeze({ x: centreX, y: centreY, z: centreZ }),
    boundsRadius: radius,
    frameCount: entry.keyword2dValue & UNSIGNED_SHORT_MASK,
    period: entry.keyword2eValue & UNSIGNED_SHORT_MASK,
  })
}

// 0x0040d550 (the figure bound to a model, a skeleton and an animation set) followed by the animation 0x0043d7a0
// starts: 0x0040dad0 plays it from the start, looping, and the figure's flag 0x10000 is set. The model part's own
// sphere (0x100278c0, not ported) only matters while no animation plays, so the part keeps a point at the origin; its
// radius scale is the model's scale, which multiplies the animation's radius.
const getPlayingFigure = (source: FigureSource, animationId: number): Figure => {
  const animations = parseAnimation(source.animationBytes).keyword2cEntries.map(getFigureAnimation)
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

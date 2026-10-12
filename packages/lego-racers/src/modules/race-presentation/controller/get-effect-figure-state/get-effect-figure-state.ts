import { createFigure, playFigureAnimation, updateFigure } from '../../../racer/index.ts'
import type { Figure, FigureAnimation } from '../../../racer/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { SkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import { getFigureAnimationState } from '../get-figure-animation-state/get-figure-animation-state.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const FIGURE_PLAYS_FLAG = 0x10000
const STEP_MILLISECONDS = 33

const getAdvancedFigure = (figure: Figure, remainingMilliseconds: number): Figure =>
  remainingMilliseconds <= 0
    ? figure
    : getAdvancedFigure(
        updateFigure(arithmetic, figure, Math.min(STEP_MILLISECONDS, remainingMilliseconds)),
        remainingMilliseconds - STEP_MILLISECONDS
      )

// An effect's figure (0x0040d550 bound to its skeleton instance, then 0x0040dad0 plays animation 0, looping) after the
// milliseconds its effect has updated it (figure slot 4, 0x0040dd60) as the animation state the pose sampling reads.
export const getEffectFigureState = (
  animations: readonly FigureAnimation[],
  elapsedMilliseconds: number
): SkeletonAnimationState => {
  const played = playFigureAnimation(createFigure(animations, null), 0)
  const playing = Object.freeze({ ...played, flags: played.flags | FIGURE_PLAYS_FLAG })
  return getFigureAnimationState(getAdvancedFigure(playing, elapsedMilliseconds))
}

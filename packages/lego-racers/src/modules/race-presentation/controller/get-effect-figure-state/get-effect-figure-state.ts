import { createFigure, playFigureAnimation, updateFigure } from '../../../racer/index.ts'
import type { Figure, FigureAnimation } from '../../../racer/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { SkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import { getFigureAnimationState } from '../get-figure-animation-state/get-figure-animation-state.ts'
import type { EffectFigureRequest } from './get-effect-figure-state.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const FIGURE_PLAYS_FLAG = 0x10000
const FIGURE_LOOPS_FLAG = 0x40000
const STEP_MILLISECONDS = 33

const getAdvancedFigure = (figure: Figure, remainingMilliseconds: number): Figure =>
  remainingMilliseconds <= 0
    ? figure
    : getAdvancedFigure(
        updateFigure(arithmetic, figure, Math.min(STEP_MILLISECONDS, remainingMilliseconds)),
        remainingMilliseconds - STEP_MILLISECONDS
      )

// A looping clip repeats every period / rate milliseconds, so the milliseconds past whole turns change nothing: replaying
// them one 33 ms step at a time overflowed the stack (and took longer every frame) once a brick had run for minutes.
const getMillisecondsInTurn = (
  animation: FigureAnimation | undefined,
  elapsedMilliseconds: number
): number => {
  if (animation === undefined || animation.rate <= 0 || animation.period <= 0) {
    return elapsedMilliseconds
  }
  const turnMilliseconds = animation.period / animation.rate
  return elapsedMilliseconds - Math.floor(elapsedMilliseconds / turnMilliseconds) * turnMilliseconds
}

// An effect's figure (0x0040d550 bound to its skeleton instance, then 0x0040dad0 plays an animation, looping unless the
// loop flag is cleared) after the milliseconds its effect has updated it (figure slot 4, 0x0040dd60) as the animation
// state the pose sampling reads.
export const getEffectFigureState = (
  animations: readonly FigureAnimation[],
  request: EffectFigureRequest
): SkeletonAnimationState => {
  const played = playFigureAnimation(createFigure(animations, null), request.animationId)
  const playing = Object.freeze({
    ...played,
    flags: (played.flags | FIGURE_PLAYS_FLAG) & (request.isLooping ? ~0 : ~FIGURE_LOOPS_FLAG),
  })
  return getFigureAnimationState(
    getAdvancedFigure(
      playing,
      request.isLooping
        ? getMillisecondsInTurn(animations[request.animationId], request.elapsedMilliseconds)
        : request.elapsedMilliseconds
    )
  )
}

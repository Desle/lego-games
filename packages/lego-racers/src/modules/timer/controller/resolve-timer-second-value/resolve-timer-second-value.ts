import { TimerDivideByZeroError } from '../../types/timer-errors/timer-errors.ts'
import {
  RANDOM_MODULO_LIMIT,
  RANDOM_MULTIPLE_DIVISOR,
} from '../../types/timer-keyword/timer-keyword.ts'
import type { Timer } from '../../types/timer.types.ts'

// LEGORacers.exe 0x00464750: a randomised second value draws once from the random table while the timer is set up.
export const resolveTimerSecondValue = (timer: Timer, drawRandomValue: () => number): number => {
  if (!timer.isSecondValueRandomised) return timer.secondValue
  const limit = timer.secondValue >>> 0
  if (limit < RANDOM_MODULO_LIMIT) {
    const drawn = drawRandomValue()
    if (limit === 0) throw new TimerDivideByZeroError()
    return drawn % limit
  }
  return Math.imul(drawRandomValue(), Math.floor(limit / RANDOM_MULTIPLE_DIVISOR)) >>> 0
}

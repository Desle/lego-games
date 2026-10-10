import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { AnimationClip } from '../../types/skeletal-animation.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// GolDP.dll 0x10018790: a time at or past the clip's loop length (entry +0x26) loses whole multiples of it;
// the caller stores the result as float32. A loop length of 0 divides by zero in the original; the time is
// returned unchanged here.
export const getWrappedTime = (clip: AnimationClip, time: number): number => {
  const loopLength = clip.loopLength
  if (time < loopLength || loopLength === 0) return time
  const wholeLoops = Math.trunc(arithmetic.divide(time, loopLength))
  return arithmetic.storeFloat(
    arithmetic.subtract(time, arithmetic.multiply(wholeLoops, loopLength))
  )
}

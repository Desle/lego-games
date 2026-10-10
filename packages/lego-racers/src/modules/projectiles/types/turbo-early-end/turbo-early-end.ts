import type { FloatArithmetic } from '../../../simulation-math/index.ts'

// 0x004b0454.
const NEAR_ZERO_SPEED = Math.fround(0.04)

// 0x0042a7f0 returned 0: the car body speed (+0x604) lies strictly between -0.04 and 0.04.
export const getIsSpeedNearZero = (arithmetic: FloatArithmetic, speed: number): boolean =>
  arithmetic.getIsBelow(speed, NEAR_ZERO_SPEED) && arithmetic.getIsBelow(-NEAR_ZERO_SPEED, speed)

import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { RaceTimeStepInput } from '../racer-physics.types.ts'

// float32 0x3fe00000 at 0x004b08c0.
const TIME_SCALE = 1.75
// 0x28 in Race_Update.
export const MAXIMUM_PHYSICS_SUB_STEP_MILLISECONDS = 40

// Race_Update 0x00435220: FILD, FMUL by 1.75f, then MSVCRT _ftol (truncation toward zero).
export const getRaceTimeStep = (arithmetic: FloatArithmetic, input: RaceTimeStepInput): number =>
  input.isTimeScaled
    ? Math.trunc(arithmetic.multiply(input.frameDeltaMilliseconds, TIME_SCALE))
    : input.frameDeltaMilliseconds

// Race_Update 0x004353da..0x0043546f: 40 ms while more than 40 ms remain, then the rest; nothing for 0.
export const getPhysicsSubSteps = (timeStepMilliseconds: number): readonly number[] => {
  const subSteps: number[] = []
  let remaining = timeStepMilliseconds
  while (remaining > 0) {
    const subStep = Math.min(remaining, MAXIMUM_PHYSICS_SUB_STEP_MILLISECONDS)
    subSteps.push(subStep)
    remaining -= subStep
  }
  return Object.freeze(subSteps)
}

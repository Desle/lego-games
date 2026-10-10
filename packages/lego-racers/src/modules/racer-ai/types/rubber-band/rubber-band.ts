import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { CAR_BODY_PUSHED_FLAG } from '../computer-speed/computer-speed.ts'
import type {
  ComputerSpeedState,
  RubberBand,
  RubberBandRacer,
  RubberBandStep,
} from '../racer-ai.types.ts'

// 0x0043a450 sets the countdown to 15,000 ms (0x3a98).
export const RUBBER_BAND_START_DELAY_MILLISECONDS = 15000
// float32 0.05 at 0x004b09dc; the same value (0x004b07f0) is the bias 0x00433773 stores at race +0x64c
// when Race_LoadTrackContent's argument is non-zero.
export const RUBBER_BAND_SPREAD = Math.fround(0.05)
export const RUBBER_BAND_RAISED_BIAS = Math.fround(0.05)
const NO_LEADER = -1

export const createRubberBand = (bias: number): RubberBand =>
  Object.freeze({ countdownMilliseconds: RUBBER_BAND_START_DELAY_MILLISECONDS, bias })

// 0x0043a0a0 (fastcall: racer): FILD lap; FADD checkpoint +0x1c, left on the FPU stack; 0.0 without one.
export const getRacerProgress = (
  arithmetic: FloatArithmetic,
  lap: number,
  checkpointProgress: number | null
): number => (checkpointProgress === null ? 0 : arithmetic.add(lap, checkpointProgress))

const setTargets = (speed: ComputerSpeedState, target: number): ComputerSpeedState =>
  Object.freeze({
    ...speed,
    defaultTargetSpeedFactor: target,
    targetSpeedFactor:
      (speed.flags & CAR_BODY_PUSHED_FLAG) === 0 ? target : speed.targetSpeedFactor,
  })

// 0x0043a480 (thiscall: step), RacerSet_Step pass 9. After the countdown runs out it runs every
// sub-step: racers ahead of the leading non-computer racer get 0.95 + bias, racers behind it
// 1.05 + bias (racer 0 is skipped); with no such leader every target goes back to 1.0.
export const stepRubberBand = (
  arithmetic: FloatArithmetic,
  rubberBand: RubberBand,
  racers: readonly RubberBandRacer[],
  stepMilliseconds: number
): RubberBandStep => {
  const { add, subtract, storeFloat, getIsBelow, getIsBelowOrEqual, getIsEqual } = arithmetic
  const speeds = racers.map((racer) => racer.speed)
  if (stepMilliseconds <= rubberBand.countdownMilliseconds) {
    return Object.freeze({
      rubberBand: Object.freeze({
        ...rubberBand,
        countdownMilliseconds: rubberBand.countdownMilliseconds - stepMilliseconds,
      }),
      speeds: Object.freeze(speeds),
    })
  }
  const nextRubberBand = Object.freeze({ ...rubberBand, countdownMilliseconds: 0 })
  const getProgress = (racer: RubberBandRacer): number =>
    getRacerProgress(arithmetic, racer.lap, racer.checkpointProgress)
  const leaderProgress = racers.reduce((best, racer) => {
    if (racer.isComputer) return best
    return getIsBelowOrEqual(getProgress(racer), best) ? best : storeFloat(getProgress(racer))
  }, NO_LEADER)
  if (getIsEqual(leaderProgress, NO_LEADER)) {
    return Object.freeze({
      rubberBand: nextRubberBand,
      speeds: Object.freeze(
        racers.map((racer) => (racer.isExempt ? racer.speed : setTargets(racer.speed, 1)))
      ),
    })
  }
  const aheadTarget = storeFloat(add(subtract(1, RUBBER_BAND_SPREAD), rubberBand.bias))
  const behindTarget = storeFloat(add(add(RUBBER_BAND_SPREAD, rubberBand.bias), 1))
  return Object.freeze({
    rubberBand: nextRubberBand,
    speeds: Object.freeze(
      racers.map((racer, index) => {
        if (index === 0 || racer.isExempt) return racer.speed
        if (!getIsBelowOrEqual(getProgress(racer), leaderProgress)) {
          return setTargets(racer.speed, aheadTarget)
        }
        return getIsBelow(getProgress(racer), leaderProgress)
          ? setTargets(racer.speed, behindTarget)
          : racer.speed
      })
    ),
  })
}

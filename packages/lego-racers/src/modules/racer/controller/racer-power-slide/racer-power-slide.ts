import {
  startDriverPowerSlide,
  stopDriverPowerSlide,
} from '../../types/racer-driver/racer-driver.ts'
import { getDriven, getRacer, setDriven, setRacer } from '../../types/racer-state/racer-state.ts'
import type { RacerBoundary, RacerSet, RacerSetContext } from '../../types/racer.types.ts'

const RACER_POWER_SLIDING_FLAG = 0x80
const DRIVER_POWER_SLIDE_FLAG = 0x4
const CAR_BODY_AIRBORNE_CONTROL_FLAG = 0x8
const PLAYER_CONTROLLER = 0

// 0x004397c0 (thiscall: direction). The vehicle dust and skid effects and sound 0x39 go to `startEffects`.
export const startRacerPowerSlide = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  direction: number,
  startEffects: RacerBoundary
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  const isSliding = (racer.flags & RACER_POWER_SLIDING_FLAG) !== 0
  if (isSliding && direction === racer.driver.slideDirection) return racerSet
  const driven = startDriverPowerSlide(context.arithmetic, getDriven(racer), direction)
  const started = setDriven(racer, driven)
  if ((driven.driver.flags & DRIVER_POWER_SLIDE_FLAG) === 0) {
    return setRacer(racerSet, racerIndex, started)
  }
  const flagged = Object.freeze({ ...started, flags: started.flags | RACER_POWER_SLIDING_FLAG })
  const updated = setRacer(racerSet, racerIndex, flagged)
  const isShowingEffects =
    flagged.controllerKind === PLAYER_CONTROLLER &&
    (flagged.carBody.rigidBody.flags & CAR_BODY_AIRBORNE_CONTROL_FLAG) === 0
  return isShowingEffects ? startEffects(context, updated, racerIndex, 0) : updated
}

// 0x00439870. The sound 0x41 and the vehicle's 0x0043dcd0 go to `endEffects`.
export const stopRacerPowerSlide = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  endEffects: RacerBoundary
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  if ((racer.flags & RACER_POWER_SLIDING_FLAG) === 0) return racerSet
  const stopped =
    (racer.driver.flags & DRIVER_POWER_SLIDE_FLAG) === 0
      ? racer
      : setDriven(racer, stopDriverPowerSlide(getDriven(racer)))
  const withEffects =
    (stopped.carBody.rigidBody.flags & CAR_BODY_AIRBORNE_CONTROL_FLAG) === 0
      ? endEffects(context, setRacer(racerSet, racerIndex, stopped), racerIndex, 0)
      : setRacer(racerSet, racerIndex, stopped)
  const after = getRacer(withEffects, racerIndex)
  return setRacer(
    withEffects,
    racerIndex,
    Object.freeze({ ...after, flags: after.flags & ~RACER_POWER_SLIDING_FLAG })
  )
}

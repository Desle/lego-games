import {
  endCarBodyFlaggedState,
  holdCarBody,
  releaseCarBody,
} from '../../types/car-body-commands/car-body-commands.ts'
import {
  clearColourShiftOverride,
  getRacerWithColourShiftOverride,
  TIMED_EFFECT_COLOUR_SHIFT,
  TIMED_EFFECT_COLOUR_SHIFT_MILLISECONDS,
} from '../../types/colour-shift-override/colour-shift-override.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { Racer, RacerBoundary, RacerSet, RacerSetContext } from '../../types/racer.types.ts'

// Racer +0xd04 bit 0x800: the racer carries a timed effect.
const RACER_TIMED_EFFECT_FLAG = 0x800
// Racer +0xc84 (the driver's +0x14) bit 0x10: set while the effect lasts.
const DRIVER_TIMED_EFFECT_FLAG = 0x10
// Racer +0x39c (the vehicle's +0x384): reaction 2, a hit.
const VEHICLE_HIT_REACTION = 2
const TIMED_EFFECT_CHARGE = 1000

// The receiver's side of 0x00439900: it carries the timed effect for the milliseconds, and its driver, vehicle and car
// body react.
export const getRacerWithTimedEffect = (
  arithmetic: FloatArithmetic,
  receiver: Racer,
  milliseconds: number
): Racer =>
  Object.freeze({
    ...getRacerWithColourShiftOverride(
      receiver,
      TIMED_EFFECT_COLOUR_SHIFT,
      TIMED_EFFECT_COLOUR_SHIFT_MILLISECONDS
    ),
    timedEffectMilliseconds: milliseconds,
    timedEffectCharge: TIMED_EFFECT_CHARGE,
    flags: receiver.flags | RACER_TIMED_EFFECT_FLAG,
    driver: Object.freeze({
      ...receiver.driver,
      flags: receiver.driver.flags | DRIVER_TIMED_EFFECT_FLAG,
    }),
    vehicle: Object.freeze({
      ...receiver.vehicle,
      reactionFlags: receiver.vehicle.reactionFlags | VEHICLE_HIT_REACTION,
    }),
    carBody: holdCarBody(arithmetic, receiver.carBody),
  })

// 0x00439900 (thiscall on the receiver: the giver's figure, the giver's +0xd7c): the receiver takes over the timed
// effect with the milliseconds the giver had left, and can pass it on in turn. Its driver and vehicle react, and its
// car body is held (0x00429380). The giver's figure parts are copied onto the receiver's figure, the effect object
// (racer +0xdac) and the vehicle's look (0x00440100) are created: presentation, not modelled.
export const transferTimedEffect = (
  context: RacerSetContext,
  racerSet: RacerSet,
  receiverIndex: number,
  giverIndex: number
): RacerSet =>
  setRacer(
    racerSet,
    receiverIndex,
    getRacerWithTimedEffect(
      context.arithmetic,
      getRacer(racerSet, receiverIndex),
      getRacer(racerSet, giverIndex).timedEffectMilliseconds
    )
  )

// 0x00439b00 (fastcall): the timed effect ends. The effect object is released and the figure and the vehicle return
// to their own look (presentation, not modelled); the countdown, the racer and driver flags and the car body's hold
// (0x004293c0) are undone.
// The racer's side of 0x00439b00: no timed effect, no flags for it, the car body released.
export const getRacerWithoutTimedEffect = (racer: Racer): Racer =>
  Object.freeze({
    ...clearColourShiftOverride(racer),
    timedEffectMilliseconds: 0,
    flags: racer.flags & ~RACER_TIMED_EFFECT_FLAG,
    driver: Object.freeze({
      ...racer.driver,
      flags: racer.driver.flags & ~DRIVER_TIMED_EFFECT_FLAG,
    }),
    carBody: releaseCarBody(racer.carBody),
  })

export const endTimedEffect: RacerBoundary = (_context, racerSet, racerIndex) =>
  setRacer(racerSet, racerIndex, getRacerWithoutTimedEffect(getRacer(racerSet, racerIndex)))

// 0x004397b0 (fastcall): car body slot 15 (0x00429c30), called while a free body's flagged state (0x80) lasts.
export const endCarBodyEffect: RacerBoundary = (_context, racerSet, racerIndex) => {
  const racer = getRacer(racerSet, racerIndex)
  return setRacer(
    racerSet,
    racerIndex,
    Object.freeze({ ...racer, carBody: endCarBodyFlaggedState(racer.carBody) })
  )
}

import {
  endCarBodyFlaggedState,
  holdCarBody,
  releaseCarBody,
} from '../../types/car-body-commands/car-body-commands.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type { RacerBoundary, RacerSet, RacerSetContext } from '../../types/racer.types.ts'

// Racer +0xd04 bit 0x800: the racer carries a timed effect.
const RACER_TIMED_EFFECT_FLAG = 0x800
// Racer +0xc84 (the driver's +0x14) bit 0x10: set while the effect lasts.
const DRIVER_TIMED_EFFECT_FLAG = 0x10
// Racer +0x39c (the vehicle's +0x384): reaction 2, a hit.
const VEHICLE_HIT_REACTION = 2
const TIMED_EFFECT_CHARGE = 1000

// 0x00439900 (thiscall on the receiver: the giver's figure, the giver's +0xd7c): the receiver takes over the timed
// effect with the milliseconds the giver had left, and can pass it on in turn. Its driver and vehicle react, and its
// car body is held (0x00429380). The giver's figure parts are copied onto the receiver's figure, the effect object
// (racer +0xdac) and the vehicle's look (0x00440100) are created: presentation, not modelled.
export const transferTimedEffect = (
  context: RacerSetContext,
  racerSet: RacerSet,
  receiverIndex: number,
  giverIndex: number
): RacerSet => {
  const giver = getRacer(racerSet, giverIndex)
  const receiver = getRacer(racerSet, receiverIndex)
  return setRacer(
    racerSet,
    receiverIndex,
    Object.freeze({
      ...receiver,
      timedEffectMilliseconds: giver.timedEffectMilliseconds,
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
      carBody: holdCarBody(context.arithmetic, receiver.carBody),
    })
  )
}

// 0x00439b00 (fastcall): the timed effect ends. The effect object is released and the figure and the vehicle return
// to their own look (presentation, not modelled); the countdown, the racer and driver flags and the car body's hold
// (0x004293c0) are undone.
export const endTimedEffect: RacerBoundary = (_context, racerSet, racerIndex) => {
  const racer = getRacer(racerSet, racerIndex)
  return setRacer(
    racerSet,
    racerIndex,
    Object.freeze({
      ...racer,
      timedEffectMilliseconds: 0,
      flags: racer.flags & ~RACER_TIMED_EFFECT_FLAG,
      driver: Object.freeze({
        ...racer.driver,
        flags: racer.driver.flags & ~DRIVER_TIMED_EFFECT_FLAG,
      }),
      carBody: releaseCarBody(racer.carBody),
    })
  )
}

// 0x004397b0 (fastcall): car body slot 15 (0x00429c30), called while a free body's flagged state (0x80) lasts.
export const endCarBodyEffect: RacerBoundary = (_context, racerSet, racerIndex) => {
  const racer = getRacer(racerSet, racerIndex)
  return setRacer(
    racerSet,
    racerIndex,
    Object.freeze({ ...racer, carBody: endCarBodyFlaggedState(racer.carBody) })
  )
}

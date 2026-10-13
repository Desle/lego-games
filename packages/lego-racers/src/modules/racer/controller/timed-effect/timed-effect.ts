import {
  endCarBodyFlaggedState,
  holdCarBody,
  releaseCarBody,
} from '../../types/car-body-commands/car-body-commands.ts'
import {
  clearColourShiftOverride,
  getRacerWithColourShiftOverride,
  TIMED_EFFECT_COLOUR_SHIFT,
} from '../../types/colour-shift-override/colour-shift-override.ts'
import { IDENTITY_MATRIX3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import {
  getCurseOrbitWithFigure,
  getCurseOrbitWithoutFigure,
} from '../../types/curse-orbit/curse-orbit.ts'
import type { CurseFigureFrame } from '../../types/curse-orbit/curse-orbit.types.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { Racer, RacerBoundary, RacerSet, RacerSetContext } from '../../types/racer.types.ts'

// A figure that was never bound holds the frame its constructor makes: the origin and the identity.
export const DEFAULT_FIGURE_FRAME: CurseFigureFrame = Object.freeze({
  position: ZERO_VECTOR3,
  rotation: IDENTITY_MATRIX3,
})

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
  milliseconds: number,
  figureFrame: CurseFigureFrame
): Racer =>
  Object.freeze({
    ...getRacerWithColourShiftOverride(receiver, TIMED_EFFECT_COLOUR_SHIFT, milliseconds),
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
      curseOrbit: getCurseOrbitWithFigure(receiver.vehicle.curseOrbit, figureFrame),
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
      getRacer(racerSet, giverIndex).timedEffectMilliseconds,
      getRacer(racerSet, giverIndex).vehicle.curseOrbit.figure ?? DEFAULT_FIGURE_FRAME
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
    vehicle: Object.freeze({
      ...racer.vehicle,
      curseOrbit: getCurseOrbitWithoutFigure(racer.vehicle.curseOrbit),
    }),
  })

// The curse's hum, Get at 0x00439a54 in 0x00439900.
const CURSE_HUM_SOUND = 8 // 0x00439a54

// 0x00439b00: the effect ends and the racer's curse loop (sound 8, 0x00439900) is stopped.
export const endTimedEffect: RacerBoundary = (_context, racerSet, racerIndex) => {
  const ended = setRacer(
    racerSet,
    racerIndex,
    getRacerWithoutTimedEffect(getRacer(racerSet, racerIndex))
  )
  return Object.freeze({
    ...ended,
    loopedSounds: Object.freeze([
      ...ended.loopedSounds,
      {
        isStart: false,
        key: `racer-curse:${String(racerIndex)}`,
        soundId: CURSE_HUM_SOUND,
        address: '0x00439b00',
        racerIndex,
      },
    ]),
  })
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

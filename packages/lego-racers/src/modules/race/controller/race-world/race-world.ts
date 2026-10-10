import { getBrickKindCode, getBrickKindFromCode } from '../../../power-ups/index.ts'
import type {
  PowerUpContext,
  PowerUpEvent,
  PowerUpStep,
  RacerPowerUps,
  RacerPowerUpStatus,
} from '../../../power-ups/index.ts'
import { getRacer, setRacer } from '../../../racer/index.ts'
import type { Racer, RacerControls, RacerSet, RacerSetContext } from '../../../racer/index.ts'
import type { RaceContacts, RaceRacerSet, RaceState } from '../../types/race.types.ts'
import {
  COMPUTER_CONTROLLER,
  getRacerAfterPowerUpEvent,
} from '../../types/racer-transitions/racer-transitions.ts'
import type { RaceWorldChange } from './race-world.types.ts'

const SHIELDED_FLAG = 0x1
const TUMBLING_FLAG = 0x8
const WARPING_FLAG = 0x10
const CURSED_FLAG = 0x800
const WARP_WITHHELD_FLAG = 0x1000
const WARP_PENDING_FLAG = 0x200000
const AIRBORNE_FLAG = 0x2
const LIGHTNING_FLAG = 0x80
const FULL_THROTTLE_FLAG = 0x1

// A player who touches nothing.
export const IDLE_RACER_CONTROLS: RacerControls = Object.freeze({
  isSteerPositivePressed: false,
  isSteerNegativePressed: false,
  isAcceleratePressed: false,
  isBrakePressed: false,
  isUsePowerUpPressed: false,
  isChangeCameraPressed: false,
  isChangeHudModePressed: false,
  isPowerSlidePressed: false,
  isLookBehindPressed: false,
  steeringAxis: 0,
  throttleAxis: 0,
})

export const NO_RACE_CONTACTS: RaceContacts = Object.freeze({
  checkpointTouches: Object.freeze([]),
  zoneCrossings: Object.freeze([]),
  brickContacts: Object.freeze([]),
  enhancementBrickContacts: Object.freeze([]),
})

// The racer set a sub-step works on: the racers, and the power-ups that ride on them (see RaceRacerSet).
export const getRaceRacerSet = (state: RaceState, contacts: RaceContacts): RaceRacerSet =>
  Object.freeze({
    ...state.racerSet,
    powerUpStep: state.powerUpStep,
    powerUpSetups: state.powerUpSetups,
    getGroundPoint: state.getGroundPoint,
    trackTargets: state.trackTargets,
    raceModeFlags: state.raceModeFlags,
    pendingContacts: contacts,
  })

export const getIsRaceRacerSet = (racerSet: RacerSet): racerSet is RaceRacerSet =>
  'powerUpStep' in racerSet && 'pendingContacts' in racerSet

export const getRaceRacerSetOf = (racerSet: RacerSet): RaceRacerSet => {
  if (!getIsRaceRacerSet(racerSet)) throw new TypeError('The racer set carries no power-ups')
  return racerSet
}

export const getRacerSetOf = (racerSet: RaceRacerSet): RacerSet =>
  Object.freeze({
    racers: racerSet.racers,
    rubberBand: racerSet.rubberBand,
    randomPosition: racerSet.randomPosition,
    collisionOrder: racerSet.collisionOrder,
  })

// What a racer tells the power-ups about itself (the flags at racer +0xd04, car body +0x6c0 and driver +0x14).
export const getRacerPowerUpStatus = (racer: Racer): RacerPowerUpStatus => {
  const { displayFrame, flags: bodyFlags } = racer.carBody.rigidBody
  const { rotation, position } = displayFrame
  return Object.freeze({
    position,
    forward: Object.freeze({ x: rotation[0], y: rotation[1], z: rotation[2] }),
    isComputer: racer.controllerKind === COMPUTER_CONTROLLER,
    isShielded: (racer.flags & SHIELDED_FLAG) !== 0,
    shieldLevel: racer.shieldLevel,
    isTumbling: (racer.flags & TUMBLING_FLAG) !== 0,
    isWarping: (racer.flags & WARPING_FLAG) !== 0,
    isCursed: (racer.flags & CURSED_FLAG) !== 0,
    isWarpWithheld: (racer.flags & WARP_WITHHELD_FLAG) !== 0,
    isWarpPending: (racer.flags & WARP_PENDING_FLAG) !== 0,
    isAirborne: (bodyFlags & AIRBORNE_FLAG) !== 0,
    isStruckByLightning: (bodyFlags & LIGHTNING_FLAG) !== 0,
    isInTurbo: (racer.driver.flags & FULL_THROTTLE_FLAG) !== 0,
  })
}

export const getPowerUpContext = (
  context: RacerSetContext,
  racerSet: RaceRacerSet
): PowerUpContext =>
  Object.freeze({
    arithmetic: context.arithmetic,
    racers: Object.freeze(racerSet.racers.map(getRacerPowerUpStatus)),
    raceModeFlags: racerSet.raceModeFlags,
    getGroundPoint: racerSet.getGroundPoint ?? (() => null),
    trackTargets: racerSet.trackTargets,
  })

// The power-up fields the racer and the power-ups both keep: held brick, use check and voice (racer +0xccc,
// +0xcd8, +0xcdc, +0xd40, +0xd44). The racer owns them between calls.
const getPowerUpRacer = (racer: Racer, powerUpRacer: RacerPowerUps): RacerPowerUps =>
  Object.freeze({
    ...powerUpRacer,
    heldBrickKind: racer.heldPowerUp === 0 ? null : getBrickKindFromCode(racer.heldPowerUp),
    useCheckElapsedMilliseconds: racer.powerUpThinkMilliseconds,
    useCheckIntervalMilliseconds: racer.powerUpThinkIntervalMilliseconds,
    voiceCooldownMilliseconds: racer.voiceMilliseconds,
    voiceSoundBase: racer.voiceBase,
  })

const getRacerWithPowerUpRacer = (racer: Racer, powerUpRacer: RacerPowerUps): Racer =>
  Object.freeze({
    ...racer,
    heldPowerUp:
      powerUpRacer.heldBrickKind === null ? 0 : getBrickKindCode(powerUpRacer.heldBrickKind),
    powerUpThinkMilliseconds: powerUpRacer.useCheckElapsedMilliseconds,
    powerUpThinkIntervalMilliseconds: powerUpRacer.useCheckIntervalMilliseconds,
    voiceMilliseconds: powerUpRacer.voiceCooldownMilliseconds,
    voiceBase: powerUpRacer.voiceSoundBase,
  })

const getRacerSetAfterEvents = (
  racerSet: RaceRacerSet,
  events: readonly PowerUpEvent[]
): RaceRacerSet =>
  events.reduce((current, event) => {
    const racerIndex = 'racer' in event ? event.racer : -1
    if (current.racers[racerIndex] === undefined) return current
    return Object.freeze({
      ...current,
      ...setRacer(
        current,
        racerIndex,
        getRacerAfterPowerUpEvent(getRacer(current, racerIndex), event)
      ),
    })
  }, racerSet)

// Runs a power-up change on the racer set: the shared fields and the random table position go in, and come back
// out, and the racer-side effects of the events it raised are applied (shield, curse, warp and magnet flags).
export const changePowerUps: RaceWorldChange = (context, racerSet, change) => {
  const step = racerSet.powerUpStep
  const synced: PowerUpStep = Object.freeze({
    ...step,
    world: Object.freeze({
      ...step.world,
      racers: Object.freeze(
        step.world.racers.map((powerUpRacer, index) =>
          getPowerUpRacer(getRacer(racerSet, index), powerUpRacer)
        )
      ),
      random: Object.freeze({ table: step.world.random.table, position: racerSet.randomPosition }),
    }),
  })
  const changed = change(synced, getPowerUpContext(context, racerSet))
  const withRacers = Object.freeze({
    ...racerSet,
    powerUpStep: changed,
    randomPosition: changed.world.random.position,
    racers: Object.freeze(
      racerSet.racers.map((racer, index) => {
        const powerUpRacer = changed.world.racers[index]
        return powerUpRacer === undefined ? racer : getRacerWithPowerUpRacer(racer, powerUpRacer)
      })
    ),
  })
  return getRacerSetAfterEvents(withRacers, changed.events.slice(step.events.length))
}

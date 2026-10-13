import { stepCarRigidBody } from '../../../racer-physics/index.ts'
import { restoreCarBodySafePose, saveCarBodySafePose } from '../../types/car-body/car-body.ts'
import {
  findNearestRacerInCone,
  stepRubberBand,
  TAUNT_MAXIMUM_DISTANCE_SQUARED,
  TAUNT_MINIMUM_COSINE,
  TAUNT_MINIMUM_DISTANCE_SQUARED,
  updateComputerTaunt,
} from '../../../racer-ai/index.ts'
import { drawRandomValue } from '../../../random-table/index.ts'
import {
  updateDriverWithoutRoute,
  updateRacerDriver,
} from '../../types/racer-driver/racer-driver.ts'
import { rankRacers } from '../../types/racer-ranking/racer-ranking.ts'
import {
  getDriven,
  getRacer,
  getRacerCollisionObjects,
  setDriven,
  setRacer,
  setRandomPosition,
} from '../../types/racer-state/racer-state.ts'
import type {
  Racer,
  RacerBoundary,
  RacerSet,
  RacerSetContext,
  RacerSetStepDependencies,
  RacerSetStepInput,
} from '../../types/racer.types.ts'
import {
  createCollideRacers,
  RACER_COLLISION_DEPENDENCIES_NOT_YET_PORTED,
} from '../collide-racers/collide-racers.ts'
import { endCarBodyEffect, endTimedEffect } from '../timed-effect/timed-effect.ts'
import { notifyRacerContact } from '../notify-racer-contact/notify-racer-contact.ts'
import { updatePlayerGuidance } from '../update-player-guidance/update-player-guidance.ts'
import { followDriverRoute } from '../follow-driver-route/follow-driver-route.ts'
import { endVehiclePowerSlideEffects } from '../../types/vehicle-emitters/vehicle-emitters.ts'
import { updateVehicle } from '../../types/vehicle/vehicle.ts'
import { stopRacerPowerSlide } from '../racer-power-slide/racer-power-slide.ts'

const COMPUTER_CONTROLLER = 2
const PLAYER_CONTROLLER = 0
const DRIVER_NO_ROUTE_FLAG = 0x80
const DRIVER_ON_ROUTE_FLAG = 0x40
const DRIVER_POWER_SLIDE_FLAG = 0x4
const RACER_FINISHED_FLAG = 0x2
const RACER_SPECIAL_FLAG = 0x8
const RACER_POWER_SLIDING_FLAG = 0x80
const RACER_RESPAWN_FLAG = 0x400
const RACER_TIMED_EFFECT_FLAG = 0x800
const RACER_WRONG_WAY_FLAGS = 0x6000
const RACER_POWER_UP_EFFECT_FLAG = 0x8000000
const RACER_FADING_FLAG = 0x10000000
const CAR_BODY_EFFECT_FLAG = 0x80
const LOWEST_SAFE_HEIGHT = -250 // 0x004b04dc
const HIGHEST_SAFE_HEIGHT = 340 // 0x004b04d8
const POWER_SLIDE_TURN = Math.fround(0.06) // 0x004b09cc
const FADE_RATE = Math.fround(0.004) // 0x004b01a8
const FADE_HOLD_MILLISECONDS = 500
const POWER_UP_THINK_INTERVAL_MILLISECONDS = 150
const COLLISION_SOUND_MILLISECONDS = 250
const RUBBER_BAND_EXEMPT_FLAGS = 0x20100000

// Stand-ins for the calls this module does not port; each returns the set unchanged.
export const keepRacerSetNotYetPorted = (_context: RacerSetContext, racerSet: RacerSet): RacerSet =>
  racerSet

// Pass 2: RigidBody_Step 0x00444ef0 on the racer's car rigid body, against the race's collision objects.
// The car body's overrides of slots +0x0c and +0x10 (0x0042a830, 0x0042a900) are not ported, so the car
// rigid body's own behaviour (every hull contact accepted, nothing after a pass) stands in for them.
export const stepRacerRigidBody: RacerBoundary = (
  context,
  racerSet,
  racerIndex,
  stepMilliseconds
) => {
  const racer = getRacer(racerSet, racerIndex)
  const rigidBody = stepCarRigidBody(context.arithmetic, racer.carBody.rigidBody, {
    stepMilliseconds,
    collisionObjects: getRacerCollisionObjects(context, racer),
  })
  return setRacer(
    racerSet,
    racerIndex,
    Object.freeze({ ...racer, carBody: Object.freeze({ ...racer.carBody, rigidBody }) })
  )
}

export const RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED: RacerSetStepDependencies = Object.freeze({
  followDriverRoute,
  stepRigidBody: stepRacerRigidBody,
  stepScriptedCarBody: keepRacerSetNotYetPorted,
  updateEngineSound: keepRacerSetNotYetPorted,
  endPowerSlideEffects: endVehiclePowerSlideEffects,
  collideRacers: createCollideRacers(RACER_COLLISION_DEPENDENCIES_NOT_YET_PORTED),
  updateVehicle,
  updateRacerSounds: keepRacerSetNotYetPorted,
  considerComputerPowerUp: keepRacerSetNotYetPorted,
  endCarBodyEffect,
  endTimedEffect,
  tauntNearestRacer: keepRacerSetNotYetPorted,
  updatePlayerGuidance,
  notifyRacerContact,
  triggerPowerUpEffect: keepRacerSetNotYetPorted,
  updateNearestRacerSound: keepRacerSetNotYetPorted,
})

const forEachRacer = (
  input: RacerSetStepInput,
  racerSet: RacerSet,
  step: RacerBoundary
): RacerSet =>
  racerSet.racers.reduce(
    (current, _racer, racerIndex) =>
      step(input.context, current, racerIndex, input.stepMilliseconds),
    racerSet
  )

const updateRacer = (racerSet: RacerSet, racerIndex: number, change: (racer: Racer) => Racer) =>
  setRacer(racerSet, racerIndex, change(getRacer(racerSet, racerIndex)))

// Pass 1: the driver (racer +0xc70).
const stepDriver =
  (dependencies: RacerSetStepDependencies): RacerBoundary =>
  (context, racerSet, racerIndex, stepMilliseconds) => {
    const racer = getRacer(racerSet, racerIndex)
    if ((racer.driver.flags & DRIVER_NO_ROUTE_FLAG) !== 0) {
      const driven = updateDriverWithoutRoute(context.arithmetic, context.tables, getDriven(racer))
      return setRacer(racerSet, racerIndex, setDriven(racer, driven))
    }
    if (racer.controllerKind === COMPUTER_CONTROLLER) {
      if ((racer.driver.flags & DRIVER_ON_ROUTE_FLAG) === 0) return racerSet
      return dependencies.followDriverRoute(context, racerSet, racerIndex, stepMilliseconds)
    }
    const update = updateRacerDriver(
      context.arithmetic,
      context.tables,
      { ...getDriven(racer), randomPosition: racerSet.randomPosition },
      stepMilliseconds
    )
    const driven = setRacer(racerSet, racerIndex, setDriven(racer, update))
    return setRandomPosition(driven, update.randomPosition)
  }

const getIsRespawning = (racer: Racer): boolean =>
  (racer.flags & RACER_RESPAWN_FLAG) !== 0 && (racer.flags & RACER_FINISHED_FLAG) !== 0

// CarBody_Update 0x004293f0 after RigidBody_Step: keep the last safe pose, and go back to it when out of range.
const settleCarBody = (context: RacerSetContext, racer: Racer): Racer => {
  const { arithmetic } = context
  const body = racer.carBody
  const isSafe =
    body.rigidBody.groundedWheelCount === 4 &&
    body.rigidBody.contactCount === 0 &&
    !getIsRespawning(racer)
  const saved = isSafe ? saveCarBodySafePose(arithmetic, body) : body
  const height = saved.rigidBody.frame.position.z
  const isOutOfRange =
    arithmetic.getIsBelow(height, LOWEST_SAFE_HEIGHT) ||
    !arithmetic.getIsBelowOrEqual(height, HIGHEST_SAFE_HEIGHT)
  const inRange = isOutOfRange ? restoreCarBodySafePose(arithmetic, saved) : saved
  const restored = getIsRespawning(racer) ? restoreCarBodySafePose(arithmetic, inRange) : inRange
  return Object.freeze({ ...racer, carBody: restored })
}

// Pass 2: the car body's slot 1, CarBody_Update 0x004293f0.
const stepCarBody =
  (dependencies: RacerSetStepDependencies): RacerBoundary =>
  (context, racerSet, racerIndex, stepMilliseconds) => {
    const racer = getRacer(racerSet, racerIndex)
    const stepped = racer.carBody.isScripted
      ? dependencies.stepScriptedCarBody(context, racerSet, racerIndex, stepMilliseconds)
      : updateRacer(
          dependencies.stepRigidBody(context, racerSet, racerIndex, stepMilliseconds),
          racerIndex,
          (current) => settleCarBody(context, current)
        )
    return dependencies.updateEngineSound(context, stepped, racerIndex, stepMilliseconds)
  }

// Pass 3: 0x00437b50 for power-sliding racers: turn the vehicle by 0.06 · (1 - forward · row 0), signed by the steering.
const stepPowerSlide =
  (dependencies: RacerSetStepDependencies): RacerBoundary =>
  (context, racerSet, racerIndex) => {
    const racer = getRacer(racerSet, racerIndex)
    if ((racer.flags & RACER_POWER_SLIDING_FLAG) === 0) return racerSet
    if ((racer.driver.flags & DRIVER_POWER_SLIDE_FLAG) === 0) {
      return stopRacerPowerSlide(context, racerSet, racerIndex, dependencies.endPowerSlideEffects)
    }
    const { add, subtract, multiply, storeFloat, getIsBelow } = context.arithmetic
    const { heading: forward, displayFrame, turnRadius: steering } = racer.carBody.rigidBody
    const [rowX, rowY, rowZ] = displayFrame.rotation
    const alignment = add(
      add(multiply(forward.z, rowZ), multiply(forward.y, rowY)),
      multiply(forward.x, rowX)
    )
    const turn = subtract(1, alignment)
    const signed = getIsBelow(steering, 0) ? -turn : turn
    return setRacer(
      racerSet,
      racerIndex,
      Object.freeze({
        ...racer,
        vehicleSlideAngle: storeFloat(
          add(multiply(signed, POWER_SLIDE_TURN), racer.vehicleSlideAngle)
        ),
      })
    )
  }

const getCountdown = (milliseconds: number, stepMilliseconds: number): number =>
  stepMilliseconds > milliseconds ? 0 : milliseconds - stepMilliseconds

// 0x004377f0, the countdowns up to the timed effect (+0xd7c).
const countDownToTimedEffect = (racer: Racer, stepMilliseconds: number): Racer => {
  const isLapCounted = racer.currentLap < racer.lapCount
  return Object.freeze({
    ...racer,
    lapMilliseconds: isLapCounted
      ? Object.freeze(
          racer.lapMilliseconds.map((milliseconds, lap) =>
            lap === racer.currentLap ? (milliseconds + stepMilliseconds) >>> 0 : milliseconds
          )
        )
      : racer.lapMilliseconds,
    voiceMilliseconds: getCountdown(racer.voiceMilliseconds, stepMilliseconds),
    collisionSoundMilliseconds: getCountdown(racer.collisionSoundMilliseconds, stepMilliseconds),
    airborneMilliseconds:
      racer.carBody.rigidBody.groundedWheelCount === 0
        ? (racer.airborneMilliseconds + stepMilliseconds) >>> 0
        : 0,
    unidentifiedCountdownD74Milliseconds: getCountdown(
      racer.unidentifiedCountdownD74Milliseconds,
      stepMilliseconds
    ),
    // When the effect is over the time is left as it is; 0x00439b00 clears it.
    timedEffectMilliseconds:
      stepMilliseconds > racer.timedEffectMilliseconds
        ? racer.timedEffectMilliseconds
        : racer.timedEffectMilliseconds - stepMilliseconds,
  })
}

// 0x004377f0, after the timed effect: +0xd84, the fade (+0xd48 → car body +0xdc) and the saved frame.
const countDownAfterTimedEffect = (
  context: RacerSetContext,
  racer: Racer,
  stepMilliseconds: number
): Racer => {
  const fadeLeft = racer.fadeMilliseconds - stepMilliseconds
  const isFading =
    stepMilliseconds < racer.fadeMilliseconds && (racer.flags & RACER_FADING_FLAG) !== 0
  const fadeFactor = !isFading
    ? 1
    : fadeLeft <= FADE_HOLD_MILLISECONDS
      ? 0
      : context.arithmetic.storeFloat(
          context.arithmetic.multiply(fadeLeft - FADE_HOLD_MILLISECONDS, FADE_RATE)
        )
  const { rigidBody } = racer.carBody
  const { displayFrame } = rigidBody
  return Object.freeze({
    ...racer,
    unidentifiedCountdownD84Milliseconds: getCountdown(
      racer.unidentifiedCountdownD84Milliseconds,
      stepMilliseconds
    ),
    fadeMilliseconds: isFading ? fadeLeft : 0,
    carBody: Object.freeze({ ...racer.carBody, fadeFactor }),
    flags: racer.flags & ~RACER_FADING_FLAG,
    savedPosition: displayFrame.position,
    savedForward: Object.freeze({
      x: displayFrame.rotation[0],
      y: displayFrame.rotation[1],
      z: displayFrame.rotation[2],
    }),
    savedVelocity: rigidBody.linearVelocity,
  })
}

// 0x004377f0 before the countdowns: the power-up think timer and the car body effect.
const stepRacerThinking = (
  input: RacerSetStepInput,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const { context, stepMilliseconds, dependencies } = input
  const racer = getRacer(racerSet, racerIndex)
  const elapsed = (racer.powerUpThinkMilliseconds + stepMilliseconds) >>> 0
  const isThinking = elapsed > racer.powerUpThinkIntervalMilliseconds
  const timed = setRacer(
    racerSet,
    racerIndex,
    Object.freeze({
      ...racer,
      powerUpThinkMilliseconds: isThinking ? 0 : elapsed,
      powerUpThinkIntervalMilliseconds: isThinking
        ? POWER_UP_THINK_INTERVAL_MILLISECONDS
        : racer.powerUpThinkIntervalMilliseconds,
    })
  )
  const isConsidering =
    isThinking && racer.controllerKind === COMPUTER_CONTROLLER && racer.heldPowerUp !== 0
  const considered = isConsidering
    ? dependencies.considerComputerPowerUp(context, timed, racerIndex, stepMilliseconds)
    : timed
  const body = getRacer(considered, racerIndex).carBody
  return (body.rigidBody.flags & CAR_BODY_EFFECT_FLAG) !== 0 && !body.isScripted
    ? dependencies.endCarBodyEffect(context, considered, racerIndex, stepMilliseconds)
    : considered
}

// 0x004377f0 after the saved frame: a computer racer taunts a racer near ahead (racer-ai's 0x0043ca60 query).
// Racer_Taunt runs before the taunt's random draw, so the draw is taken again after it.
const stepTaunt = (input: RacerSetStepInput, racerSet: RacerSet, racerIndex: number): RacerSet => {
  const { context, dependencies, stepMilliseconds } = input
  const racer = getRacer(racerSet, racerIndex)
  const isComputer = racer.controllerKind === COMPUTER_CONTROLLER
  const isRacerNearAhead =
    findNearestRacerInCone(context.arithmetic, {
      racerPositions: racerSet.racers.map(
        (current) => current.carBody.rigidBody.displayFrame.position
      ),
      origin: racer.savedPosition,
      direction: racer.savedForward,
      minimumDistanceSquared: TAUNT_MINIMUM_DISTANCE_SQUARED,
      maximumDistanceSquared: TAUNT_MAXIMUM_DISTANCE_SQUARED,
      minimumCosine: TAUNT_MINIMUM_COSINE,
    }) !== null
  const getTaunt = (position: number) =>
    updateComputerTaunt(
      context.tables.randomTable,
      position,
      racer.proximityCheckMilliseconds,
      stepMilliseconds,
      isComputer,
      isRacerNearAhead
    )
  const isTaunting = getTaunt(racerSet.randomPosition).isTaunting
  const taunted = isTaunting
    ? dependencies.tauntNearestRacer(context, racerSet, racerIndex, stepMilliseconds)
    : racerSet
  const taunt = getTaunt(taunted.randomPosition)
  const updated = updateRacer(taunted, racerIndex, (current) =>
    Object.freeze({ ...current, proximityCheckMilliseconds: taunt.tauntMilliseconds })
  )
  return setRandomPosition(updated, taunt.position)
}

// 0x004377f0, the collision sound: a random draw picks sound 0x19 or 0x38 and waits 250 ms.
const stepContact = (
  input: RacerSetStepInput,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const { context, dependencies, stepMilliseconds } = input
  if (getRacer(racerSet, racerIndex).carBody.rigidBody.contactCount === 0) return racerSet
  const notified = dependencies.notifyRacerContact(context, racerSet, racerIndex, stepMilliseconds)
  if (getRacer(notified, racerIndex).collisionSoundMilliseconds !== 0) return notified
  const draw = drawRandomValue(context.tables.randomTable, notified.randomPosition)
  const waited = updateRacer(notified, racerIndex, (current) =>
    Object.freeze({ ...current, collisionSoundMilliseconds: COLLISION_SOUND_MILLISECONDS })
  )
  // The draw's low bit picks the sound: 0x19 when set, else 0x38 (0x00437b1a).
  const sounded: RacerSet = Object.freeze({
    ...waited,
    sounds: Object.freeze([
      ...waited.sounds,
      { soundId: (draw.value & 1) === 0 ? 0x38 : 0x19, address: '0x00437b1a', racerIndex },
    ]),
  })
  return setRandomPosition(sounded, draw.position)
}

// Pass 7: 0x004377f0 (thiscall: step), the racer's timers.
const stepRacerTimers =
  (input: RacerSetStepInput): RacerBoundary =>
  (context, racerSet, racerIndex, stepMilliseconds) => {
    const { dependencies } = input
    if ((getRacer(racerSet, racerIndex).flags & RACER_FINISHED_FLAG) !== 0) return racerSet
    const thought = stepRacerThinking(input, racerSet, racerIndex)
    const racer = getRacer(thought, racerIndex)
    const isEffectOver =
      stepMilliseconds > racer.timedEffectMilliseconds &&
      (racer.flags & RACER_TIMED_EFFECT_FLAG) !== 0
    const counted = setRacer(thought, racerIndex, countDownToTimedEffect(racer, stepMilliseconds))
    const ended = isEffectOver
      ? dependencies.endTimedEffect(context, counted, racerIndex, stepMilliseconds)
      : counted
    const settled = updateRacer(ended, racerIndex, (current) =>
      countDownAfterTimedEffect(context, current, stepMilliseconds)
    )
    const checked = stepTaunt(input, settled, racerIndex)
    const guided =
      getRacer(checked, racerIndex).controllerKind === PLAYER_CONTROLLER
        ? dependencies.updatePlayerGuidance(context, checked, racerIndex, stepMilliseconds)
        : updateRacer(checked, racerIndex, (current) =>
            Object.freeze({
              ...current,
              wrongWayMilliseconds: 0,
              flags: current.flags & ~RACER_WRONG_WAY_FLAGS,
            })
          )
    const touched = stepContact(input, guided, racerIndex)
    const flags = getRacer(touched, racerIndex).flags
    const isPowerUpEffect =
      (flags & RACER_POWER_UP_EFFECT_FLAG) !== 0 && (flags & RACER_SPECIAL_FLAG) === 0
    return isPowerUpEffect
      ? dependencies.triggerPowerUpEffect(context, touched, racerIndex, stepMilliseconds)
      : touched
  }

// Pass 9, racer-ai's RubberBand_Step 0x0043a480 on the car bodies' speed factors.
const stepRacerSetRubberBand = (
  context: RacerSetContext,
  racerSet: RacerSet,
  stepMilliseconds: number
): RacerSet => {
  const step = stepRubberBand(
    context.arithmetic,
    racerSet.rubberBand,
    racerSet.racers.map((racer) => ({
      isComputer: racer.controllerKind === COMPUTER_CONTROLLER,
      isExempt: (racer.flags & RUBBER_BAND_EXEMPT_FLAGS) !== 0,
      lap: racer.lap,
      checkpointProgress: context.checkpoints[racer.checkpointIndex]?.progress ?? null,
      speed: {
        flags: racer.carBody.rigidBody.flags,
        speedFactor: racer.carBody.speedFactor,
        targetSpeedFactor: racer.carBody.targetSpeedFactor,
        defaultTargetSpeedFactor: racer.carBody.defaultTargetSpeedFactor,
      },
    })),
    stepMilliseconds
  )
  return Object.freeze({
    ...racerSet,
    rubberBand: step.rubberBand,
    racers: Object.freeze(
      racerSet.racers.map((racer, index) => {
        const speed = step.speeds[index]
        if (speed === undefined) return racer
        return Object.freeze({
          ...racer,
          carBody: Object.freeze({
            ...racer.carBody,
            targetSpeedFactor: speed.targetSpeedFactor,
            defaultTargetSpeedFactor: speed.defaultTargetSpeedFactor,
          }),
        })
      })
    ),
  })
}

// RacerSet_Step 0x0043c030 (thiscall on race +0x3bc: step): nine passes over the racers for one sub-step.
export const stepRacerSet = (input: RacerSetStepInput): RacerSet => {
  const { context, stepMilliseconds, dependencies } = input
  const driven = forEachRacer(input, input.racerSet, stepDriver(dependencies))
  const bodies = forEachRacer(input, driven, stepCarBody(dependencies))
  const slid = forEachRacer(input, bodies, stepPowerSlide(dependencies))
  const collided = dependencies.collideRacers(context, slid, stepMilliseconds)
  const vehicles = forEachRacer(input, collided, dependencies.updateVehicle)
  const sounded = forEachRacer(input, vehicles, dependencies.updateRacerSounds)
  const timed = forEachRacer(input, sounded, stepRacerTimers(input))
  const ranked = dependencies.updateNearestRacerSound(
    context,
    rankRacers(context, timed),
    stepMilliseconds
  )
  return stepRacerSetRubberBand(context, ranked, stepMilliseconds)
}

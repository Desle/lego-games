import { createRubberBand, getRacerProgress } from '../../../racer-ai/index.ts'
import type { RandomTablePosition } from '../../../random-table/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import { createRacerDriver } from '../racer-driver/racer-driver.ts'
import type { CarBody, DrivenCarBody, Racer, RacerSet, RacerSetContext } from '../racer.types.ts'

const COMPUTER_CONTROLLER = 2
const NO_POWER_UP_CHANCE = 0xff
const LAP_SLOTS = 5
const NO_CHECKPOINT = -1

// Racer_Constructor 0x00436990 with its field reset 0x00436bd0; the car body comes from 0x00429020 and its attach.
export const createRacer = (carBody: CarBody): Racer =>
  Object.freeze({
    carBody,
    driver: createRacerDriver(),
    vehicleSlideAngle: 0,
    checkpointIndex: NO_CHECKPOINT,
    checkpointSide: 1,
    lapCrossings: -1,
    zoneCurrent: 0,
    zonePrevious: 2,
    zoneBeforePrevious: 1,
    shieldLevel: 0,
    heldPowerUp: 0,
    powerUpThinkMilliseconds: 0,
    powerUpThinkIntervalMilliseconds: 150,
    lapCount: 0,
    currentLap: 0,
    lapMilliseconds: Object.freeze(Array.from({ length: LAP_SLOTS }, () => 0)),
    racePosition: 0,
    flags: 0,
    controllerKind: COMPUTER_CONTROLLER,
    lap: -1,
    powerUpChances: Object.freeze(Array.from({ length: 6 }, () => NO_POWER_UP_CHANCE)),
    proximityCheckMilliseconds: 0,
    voiceBase: 1000,
    voiceMilliseconds: 0,
    fadeMilliseconds: 0,
    collisionSoundMilliseconds: 0,
    airborneMilliseconds: 0,
    unidentifiedCountdownD74Milliseconds: 0,
    unidentifiedCountdownD84Milliseconds: 0,
    wrongWayMilliseconds: 0,
    timedEffectMilliseconds: 0,
    savedPosition: ZERO_VECTOR3,
    savedVelocity: ZERO_VECTOR3,
    savedForward: ZERO_VECTOR3,
  })

// RacerSet_Setup 0x0043b190 ends with 0x0043a450 (the rubber band; its bias is race +0x64c).
export const createRacerSet = (
  racers: readonly Racer[],
  randomPosition: RandomTablePosition,
  rubberBandBias: number
): RacerSet =>
  Object.freeze({
    racers: Object.freeze([...racers]),
    rubberBand: createRubberBand(rubberBandBias),
    randomPosition,
  })

export const getRacer = (racerSet: RacerSet, racerIndex: number): Racer => {
  const racer = racerSet.racers[racerIndex]
  if (racer === undefined) throw new RangeError(`No racer ${String(racerIndex)}`)
  return racer
}

export const setRacer = (racerSet: RacerSet, racerIndex: number, racer: Racer): RacerSet =>
  Object.freeze({
    ...racerSet,
    racers: Object.freeze(
      racerSet.racers.map((current, index) => (index === racerIndex ? racer : current))
    ),
  })

export const setRandomPosition = (
  racerSet: RacerSet,
  randomPosition: RandomTablePosition
): RacerSet => Object.freeze({ ...racerSet, randomPosition })

export const getDriven = (racer: Racer): DrivenCarBody =>
  Object.freeze({ driver: racer.driver, carBody: racer.carBody })

export const setDriven = (racer: Racer, driven: DrivenCarBody): Racer =>
  Object.freeze({ ...racer, driver: driven.driver, carBody: driven.carBody })

// 0x0043a0a0 through racer-ai: lap + checkpoint progress, 0 without a checkpoint. Not stored.
export const getRacerSetProgress = (context: RacerSetContext, racer: Racer): number =>
  getRacerProgress(
    context.arithmetic,
    racer.lap,
    context.checkpoints[racer.checkpointIndex]?.progress ?? null
  )

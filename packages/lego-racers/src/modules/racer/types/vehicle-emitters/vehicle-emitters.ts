import {
  getEmitterBornCount,
  getHasEmitterDefinition,
  getIsEmitterHandleLive,
  releaseEmitter,
  releaseEmitterImmediately,
  spawnEmitter,
} from '../../../emitter/index.ts'
import type { EmitterPool, EmitterReference } from '../../../emitter/index.ts'
import { drawRandomValue } from '../../../random-table/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { getRacer, setRacer, setRandomPosition } from '../racer-state/racer-state.ts'
import type { Racer, RacerBoundary, RacerSet, RacerSetContext, Vehicle } from '../racer.types.ts'
import type { SpawnedVehicleEmitter } from './vehicle-emitters.types.ts'

const COMPUTER_CONTROLLER = 2
const RACER_TUMBLING_FLAG = 0x8
const RACER_DISABLED_FLAG = 0x10
const CAR_BODY_SPINNING_FLAG = 0x2
const TIRE_SMOKE_RUNNING_FLAG = 0x8
const WHEELS_SPINNING_FLAG = 0x100
const LANDING_PENDING_FLAG = 0x200
// Vehicle_Update 0x0043e070: 400 ms without a wheel on the ground make the next landing count.
const LANDING_AIRBORNE_MILLISECONDS = 400
// A dust emitter that has born more than 9 particles is let go, a boost smoke emitter more than 3.
const DUST_MAXIMUM_BORN_COUNT = 9
const BOOST_SMOKE_MAXIMUM_BORN_COUNT = 3
const NAME_COMPARED_LENGTH = 8
const NO_WHEEL_EMITTER_NAME = ''
// The wheels whose emitters keep the vehicle's dust from starting (vehicle +0x238 and +0x23c).
const DUST_BLOCKING_WHEELS = [2, 3] as const

const getPoolOf = (racerSet: RacerSet, isCommonPool: boolean): EmitterPool | null =>
  isCommonPool ? racerSet.emitters.common : racerSet.emitters.track

const getRacerSetWithPool = (
  racerSet: RacerSet,
  isCommonPool: boolean,
  pool: EmitterPool
): RacerSet =>
  Object.freeze({
    ...racerSet,
    emitters: Object.freeze(
      isCommonPool ? { ...racerSet.emitters, common: pool } : { ...racerSet.emitters, track: pool }
    ),
  })

// 0x00489d70 on one pool: the emitter of this name, with the handle it returns (null for none free, no such emitter
// or a one-shot).
const spawnVehicleEmitter = (
  arithmetic: FloatArithmetic,
  racerSet: RacerSet,
  isCommonPool: boolean,
  name: string
): SpawnedVehicleEmitter => {
  const pool = getPoolOf(racerSet, isCommonPool)
  if (pool === null || !getHasEmitterDefinition(pool, name)) return { racerSet, reference: null }
  const spawn = spawnEmitter(arithmetic, pool, name, { position: null, orientation: null })
  return {
    racerSet: getRacerSetWithPool(racerSet, isCommonPool, spawn.pool),
    reference: spawn.handleIndex === null ? null : { isCommonPool, handleIndex: spawn.handleIndex },
  }
}

// 0x00489f30 (deferred) and 0x00489f00 (at once) on the handle's pool.
const releaseVehicleEmitter = (
  racerSet: RacerSet,
  reference: EmitterReference,
  isImmediate: boolean
): RacerSet => {
  const pool = getPoolOf(racerSet, reference.isCommonPool)
  if (pool === null) return racerSet
  return getRacerSetWithPool(
    racerSet,
    reference.isCommonPool,
    isImmediate
      ? releaseEmitterImmediately(pool, reference.handleIndex)
      : releaseEmitter(pool, reference.handleIndex)
  )
}

const setVehicle = (
  racerSet: RacerSet,
  racerIndex: number,
  change: (vehicle: Vehicle) => Vehicle
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  return setRacer(
    racerSet,
    racerIndex,
    Object.freeze({ ...racer, vehicle: Object.freeze(change(racer.vehicle)) })
  )
}

// 0x0043def0: the dust emitter starts unless the vehicle already has one or its rear wheels hold surface emitters.
export const startVehicleDust = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const { vehicle } = getRacer(racerSet, racerIndex)
  const isBlocked =
    vehicle.dustEmitter !== null ||
    DUST_BLOCKING_WHEELS.some((wheelIndex) => vehicle.wheelEmitters[wheelIndex] !== null)
  if (isBlocked) return racerSet
  const spawned = spawnVehicleEmitter(context.arithmetic, racerSet, true, 'dust')
  return setVehicle(spawned.racerSet, racerIndex, (current) => ({
    ...current,
    dustEmitter: spawned.reference,
  }))
}

// 0x0043df90: the boost smoke starts unless the vehicle already has one.
export const startVehicleBoostSmoke = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  if (getRacer(racerSet, racerIndex).vehicle.boostEmitter !== null) return racerSet
  const spawned = spawnVehicleEmitter(context.arithmetic, racerSet, true, 'carsmke')
  return setVehicle(spawned.racerSet, racerIndex, (current) => ({
    ...current,
    boostEmitter: spawned.reference,
  }))
}

// 0x0043dc00: the tire smoke starts (unless the racer tumbles) and the vehicle remembers it runs.
export const startVehicleTireSmoke = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  if ((racer.flags & RACER_TUMBLING_FLAG) !== 0) return racerSet
  const spawned =
    racer.vehicle.tireSmokeEmitter === null
      ? spawnVehicleEmitter(context.arithmetic, racerSet, true, 'tiresmk')
      : { racerSet, reference: racer.vehicle.tireSmokeEmitter }
  return setVehicle(spawned.racerSet, racerIndex, (current) => ({
    ...current,
    tireSmokeEmitter: spawned.reference,
    flags: current.flags | TIRE_SMOKE_RUNNING_FLAG,
  }))
}

// 0x0043dcd0: the tire smoke is let go.
export const stopVehicleTireSmoke = (racerSet: RacerSet, racerIndex: number): RacerSet => {
  const { vehicle } = getRacer(racerSet, racerIndex)
  const released =
    vehicle.tireSmokeEmitter === null
      ? racerSet
      : releaseVehicleEmitter(racerSet, vehicle.tireSmokeEmitter, false)
  return setVehicle(released, racerIndex, (current) => ({
    ...current,
    tireSmokeEmitter: null,
    flags: current.flags & ~TIRE_SMOKE_RUNNING_FLAG,
  }))
}

// 0x0043fd30 (from 0x004396c0, before it records the level): a racer that is not a computer starts its dust and boost
// smoke, and the tire smoke when its previous turbo had a level.
export const startVehicleTurboEffects = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  if (racer.controllerKind === COMPUTER_CONTROLLER) return racerSet
  const smoking = startVehicleBoostSmoke(
    context,
    startVehicleDust(context, racerSet, racerIndex),
    racerIndex
  )
  return racer.turboLevel === 0 ? smoking : startVehicleTireSmoke(context, smoking, racerIndex)
}

// 0x0043fd90: the wheels spin up; a racer that is not a computer starts its tire smoke.
const startVehicleWheelSpin = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const flagged = setVehicle(racerSet, racerIndex, (vehicle) => ({
    ...vehicle,
    flags: vehicle.flags | WHEELS_SPINNING_FLAG,
  }))
  return getRacer(flagged, racerIndex).controllerKind === COMPUTER_CONTROLLER
    ? flagged
    : startVehicleTireSmoke(context, flagged, racerIndex)
}

// 0x0043fdb0: the wheels stop spinning and the tire smoke is let go.
const stopVehicleWheelSpin = (racerSet: RacerSet, racerIndex: number): RacerSet =>
  stopVehicleTireSmoke(
    setVehicle(racerSet, racerIndex, (vehicle) => ({
      ...vehicle,
      flags: vehicle.flags & ~WHEELS_SPINNING_FLAG,
    })),
    racerIndex
  )

const getNameKey = (name: string): string => name.slice(0, NAME_COMPARED_LENGTH)

// 0x0043dd50: a wheel's surface emitter. One already running under this name stays; another is stopped at once. The
// common pool answers first when it holds an emitter of the name, else the track's.
export const setVehicleWheelEmitter = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  wheelIndex: number,
  name: string
): RacerSet => {
  const { vehicle } = getRacer(racerSet, racerIndex)
  const running = vehicle.wheelEmitters[wheelIndex] ?? null
  if (
    running !== null &&
    getNameKey(vehicle.wheelEmitterNames[wheelIndex] ?? '') === getNameKey(name)
  ) {
    return racerSet
  }
  const stopped = running === null ? racerSet : releaseVehicleEmitter(racerSet, running, true)
  const isCommonPool =
    stopped.emitters.common !== null && getHasEmitterDefinition(stopped.emitters.common, name)
  const isTrackPool =
    !isCommonPool &&
    stopped.emitters.track !== null &&
    getHasEmitterDefinition(stopped.emitters.track, name)
  const spawned =
    isCommonPool || isTrackPool
      ? spawnVehicleEmitter(context.arithmetic, stopped, isCommonPool, name)
      : { racerSet: stopped, reference: null }
  return setVehicle(spawned.racerSet, racerIndex, (current) => ({
    ...current,
    wheelEmitters: current.wheelEmitters.map((emitter, index) =>
      index === wheelIndex ? spawned.reference : emitter
    ),
    wheelEmitterNames: current.wheelEmitterNames.map((current_name, index) =>
      index === wheelIndex ? name : current_name
    ),
  }))
}

// 0x0043de90: a wheel's surface emitter stops at once.
export const clearVehicleWheelEmitter = (
  racerSet: RacerSet,
  racerIndex: number,
  wheelIndex: number
): RacerSet => {
  const { vehicle } = getRacer(racerSet, racerIndex)
  const running = vehicle.wheelEmitters[wheelIndex] ?? null
  if (running === null) return racerSet
  return setVehicle(releaseVehicleEmitter(racerSet, running, true), racerIndex, (current) => ({
    ...current,
    wheelEmitters: current.wheelEmitters.map((emitter, index) =>
      index === wheelIndex ? null : emitter
    ),
    wheelEmitterNames: current.wheelEmitterNames.map((name, index) =>
      index === wheelIndex ? NO_WHEEL_EMITTER_NAME : name
    ),
  }))
}

const getIsReferenceExhausted = (
  racerSet: RacerSet,
  reference: EmitterReference,
  maximumBornCount: number
): boolean => {
  const pool = getPoolOf(racerSet, reference.isCommonPool)
  if (pool === null || !getIsEmitterHandleLive(pool, reference.handleIndex)) return true
  return (getEmitterBornCount(pool, reference.handleIndex) ?? 0) > maximumBornCount
}

const drawCursor = (context: RacerSetContext, racerSet: RacerSet): RacerSet =>
  setRandomPosition(
    racerSet,
    drawRandomValue(context.tables.randomTable, racerSet.randomPosition).position
  )

// The emitter part of Vehicle_Update 0x0043e070 (after the driver update): the wheel spin starts and stops the tire
// smoke, a racer that tumbles stops it, a landing after 400 ms in the air puts down dust, and the dust, boost smoke
// and tire smoke emitters live on: the dust is let go after 9 births, the boost smoke after 3, the dust and the tire
// smoke each draw once for where they sit.
export const updateVehicleEmitters = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const first = getRacer(racerSet, racerIndex)
  if ((first.flags & RACER_DISABLED_FLAG) !== 0) return racerSet
  const isSpinning = (first.carBody.rigidBody.flags & CAR_BODY_SPINNING_FLAG) !== 0
  const isWheelSpinFlagged = (first.vehicle.flags & WHEELS_SPINNING_FLAG) !== 0
  const spun = isSpinning
    ? isWheelSpinFlagged
      ? racerSet
      : startVehicleWheelSpin(context, racerSet, racerIndex)
    : isWheelSpinFlagged
      ? stopVehicleWheelSpin(racerSet, racerIndex)
      : racerSet
  const afterSpin = getRacer(spun, racerIndex)
  const stopped =
    (afterSpin.flags & RACER_TUMBLING_FLAG) !== 0 &&
    (afterSpin.vehicle.flags & TIRE_SMOKE_RUNNING_FLAG) !== 0
      ? stopVehicleTireSmoke(spun, racerIndex)
      : spun
  const landed = getRacerAfterLanding(context, stopped, racerIndex)
  return updateRunningEmitters(context, landed, racerIndex)
}

// The landing of Vehicle_Update: more than 400 ms airborne arms it, the next update with more wheels on the ground
// than the last puts down the "carland" emitter; the count is remembered every update.
const getRacerAfterLanding = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const racer: Racer = getRacer(racerSet, racerIndex)
  const { vehicle } = racer
  const { groundedWheelCount, airborneTime } = racer.carBody.rigidBody
  const isArmed =
    airborneTime > LANDING_AIRBORNE_MILLISECONDS || (vehicle.flags & LANDING_PENDING_FLAG) !== 0
  const isLanding = isArmed && groundedWheelCount > vehicle.previousGroundedWheelCount
  const spawned = isLanding
    ? spawnVehicleEmitter(context.arithmetic, racerSet, true, 'carland').racerSet
    : racerSet
  const armedFlags =
    airborneTime > LANDING_AIRBORNE_MILLISECONDS
      ? vehicle.flags | LANDING_PENDING_FLAG
      : vehicle.flags
  return setVehicle(spawned, racerIndex, (current) => ({
    ...current,
    flags: isLanding ? armedFlags & ~LANDING_PENDING_FLAG : armedFlags,
    previousGroundedWheelCount: groundedWheelCount,
  }))
}

const updateRunningEmitters = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const { dustEmitter, boostEmitter, tireSmokeEmitter } = getRacer(racerSet, racerIndex).vehicle
  const dusted =
    dustEmitter === null
      ? racerSet
      : getIsReferenceExhausted(racerSet, dustEmitter, DUST_MAXIMUM_BORN_COUNT)
        ? setVehicle(
            releaseVehicleEmitter(racerSet, dustEmitter, false),
            racerIndex,
            (vehicle) => ({
              ...vehicle,
              dustEmitter: null,
            })
          )
        : drawCursor(context, racerSet)
  const boosted =
    boostEmitter === null
      ? dusted
      : getIsReferenceExhausted(dusted, boostEmitter, BOOST_SMOKE_MAXIMUM_BORN_COUNT)
        ? setVehicle(releaseVehicleEmitter(dusted, boostEmitter, false), racerIndex, (vehicle) => ({
            ...vehicle,
            boostEmitter: null,
          }))
        : dusted
  return tireSmokeEmitter === null ? boosted : drawCursor(context, boosted)
}

const DRIVER_FULL_THROTTLE_FLAG = 0x1

// 0x004397c0 (a player's power slide begins, the car not in two-point mode): the dust starts and, unless the tire smoke
// runs, the tire smoke.
export const startVehiclePowerSlideEffects: RacerBoundary = (context, racerSet, racerIndex) => {
  const dusted = startVehicleDust(context, racerSet, racerIndex)
  return (getRacer(dusted, racerIndex).vehicle.flags & TIRE_SMOKE_RUNNING_FLAG) === 0
    ? startVehicleTireSmoke(context, dusted, racerIndex)
    : dusted
}

// 0x00439870 (the power slide ends, the car not in two-point mode): the tire smoke is let go unless the driver is at
// full throttle.
export const endVehiclePowerSlideEffects: RacerBoundary = (_context, racerSet, racerIndex) =>
  (getRacer(racerSet, racerIndex).driver.flags & DRIVER_FULL_THROTTLE_FLAG) === 0
    ? stopVehicleTireSmoke(racerSet, racerIndex)
    : racerSet

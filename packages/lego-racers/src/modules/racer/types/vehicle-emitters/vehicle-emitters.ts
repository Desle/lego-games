import {
  getEmitterBornCount,
  getHasEmitterDefinition,
  getIsEmitterHandleLive,
  releaseEmitter,
  releaseEmitterImmediately,
  spawnEmitter,
} from '../../../emitter/index.ts'
import type { EmitterPool, EmitterReference } from '../../../emitter/index.ts'
import { drawRandomLowByte } from '../../../random-table/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getRacer, setRacer, setRandomPosition } from '../racer-state/racer-state.ts'
import type { Racer, RacerBoundary, RacerSet, RacerSetContext, Vehicle } from '../racer.types.ts'
import {
  getSkidCooldownsStepped,
  getSkidsStarted,
  getSkidsStepped,
  getSkidsStopped,
  getSkidsWithImageName,
  SKID_IMAGE_NAME,
  TURBO_SKID_IMAGE_NAME,
} from '../vehicle-skids/vehicle-skids.ts'
import {
  getBoostSmokePosition,
  getDustPosition,
  getEmitterVelocityOffset,
  getRearRightWheelAnchor,
  getTireSmokePosition,
  getWheelAnchor,
  placeVehicleEmitter,
} from './vehicle-emitter-placement.ts'
import type { RandomBit, SpawnedVehicleEmitter } from './vehicle-emitters.types.ts'

const COMPUTER_CONTROLLER = 2
const RACER_TUMBLING_FLAG = 0x8
const RACER_DISABLED_FLAG = 0x10
const CAR_BODY_SPINNING_FLAG = 0x2
const TIRE_SMOKE_RUNNING_FLAG = 0x8
const WHEELS_SPINNING_FLAG = 0x100
const LANDING_PENDING_FLAG = 0x200
// Vehicle_Update 0x0043e070: 400 ms without a wheel on the ground make the next landing count.
const LANDING_AIRBORNE_MILLISECONDS = 400
// 0x2 the fade, 0x4 and 0x10 presentation, 0x100 the wheels spin.
const WARP_CLEARED_VEHICLE_FLAGS = 0x116
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
  name: string,
  position: Vector3 | null = null
): SpawnedVehicleEmitter => {
  const pool = getPoolOf(racerSet, isCommonPool)
  if (pool === null || !getHasEmitterDefinition(pool, name)) return { racerSet, reference: null }
  const spawn = spawnEmitter(arithmetic, pool, name, { position, orientation: null })
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

// 0x00438bc4 (the collision response of two racers): a spark emitter, a one-shot of the common pool, whose handle
// nobody keeps.
export const startCollisionSparks = (context: RacerSetContext, racerSet: RacerSet): RacerSet =>
  spawnVehicleEmitter(context.arithmetic, racerSet, true, 'carsprk').racerSet

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
  const racer = getRacer(spawned.racerSet, racerIndex)
  const placed = placeVehicleEmitter(
    context.arithmetic,
    spawned.racerSet,
    spawned.reference,
    racer,
    getRearRightWheelAnchor(racer),
    null
  )
  return setVehicle(placed, racerIndex, (current) => ({
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
  const racer = getRacer(spawned.racerSet, racerIndex)
  const placed = placeVehicleEmitter(
    context.arithmetic,
    spawned.racerSet,
    spawned.reference,
    racer,
    getBoostSmokePosition(context.arithmetic, racer),
    null
  )
  return setVehicle(placed, racerIndex, (current) => ({
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
  const placed =
    racer.vehicle.tireSmokeEmitter === null
      ? placeVehicleEmitter(
          context.arithmetic,
          spawned.racerSet,
          spawned.reference,
          racer,
          getRearRightWheelAnchor(racer),
          null
        )
      : spawned.racerSet
  return setVehicle(placed, racerIndex, (current) => ({
    ...current,
    tireSmokeEmitter: spawned.reference,
    skids: getSkidsStarted(current.skids, racer.carBody.rigidBody.flags),
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
    skids: getSkidsStopped(current.skids),
    flags: current.flags & ~TIRE_SMOKE_RUNNING_FLAG,
  }))
}

// 0x004395d0's vehicle part (0x0043dcd0, 0x0043dbb0, the flags 0x14 cleared, 0x0043fd70 and 0x0043fdb0): the tire smoke
// is let go, the fade (flag 2) and the presentation flags 4 and 0x10 go, and the wheels stop spinning. The skid
// marks (vehicle +0x1e4) are presentation and not kept.
export const stopVehicleEffectsForWarp = (racerSet: RacerSet, racerIndex: number): RacerSet =>
  setVehicle(stopVehicleTireSmoke(racerSet, racerIndex), racerIndex, (vehicle) => ({
    ...vehicle,
    skids: getSkidsWithImageName(vehicle.skids, SKID_IMAGE_NAME),
    flags: vehicle.flags & ~WARP_CLEARED_VEHICLE_FLAGS,
  }))

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
  if (racer.turboLevel === 0) return smoking
  const named = setVehicle(smoking, racerIndex, (current) => ({
    ...current,
    skids: getSkidsWithImageName(current.skids, TURBO_SKID_IMAGE_NAME),
  }))
  return startVehicleTireSmoke(context, named, racerIndex)
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
  const racer = getRacer(spawned.racerSet, racerIndex)
  const placed = placeVehicleEmitter(
    context.arithmetic,
    spawned.racerSet,
    spawned.reference,
    racer,
    getWheelAnchor(racer, wheelIndex),
    null
  )
  return setVehicle(placed, racerIndex, (current) => ({
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

// One draw of the random cursor: the low byte's second bit.
const drawBit = (context: RacerSetContext, racerSet: RacerSet): RandomBit => {
  const draw = drawRandomLowByte(context.tables.randomTable, racerSet.randomPosition)
  return { racerSet: setRandomPosition(racerSet, draw.position), isSet: (draw.value & 2) !== 0 }
}

// The emitter part of Vehicle_Update 0x0043e070 (after the driver update): the wheel spin starts and stops the tire
// smoke, a racer that tumbles stops it, a landing after 400 ms in the air puts down dust, and the dust, boost smoke
// and tire smoke emitters live on: the dust is let go after 9 births, the boost smoke after 3, the dust and the tire
// smoke each draw once for where they sit.
export const updateVehicleEmitters = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  stepMilliseconds: number
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
  const cooled = setVehicle(spun, racerIndex, (vehicle) => ({
    ...vehicle,
    skids: getSkidCooldownsStepped(vehicle.skids, stepMilliseconds),
  }))
  const afterSpin = getRacer(cooled, racerIndex)
  const stopped =
    (afterSpin.flags & RACER_TUMBLING_FLAG) !== 0 &&
    (afterSpin.vehicle.flags & TIRE_SMOKE_RUNNING_FLAG) !== 0
      ? stopVehicleTireSmoke(cooled, racerIndex)
      : cooled
  const skidded = getRacerAfterSkids(context, stopped, racerIndex, stepMilliseconds)
  const wheeled = getRacerWithWheelEmittersPlaced(context, skidded, racerIndex)
  const landed = getRacerAfterLanding(context, wheeled, racerIndex)
  return updateRunningEmitters(context, landed, racerIndex)
}

// 0x0043e1d3: the surface emitters of the wheels follow their wheels with a share of the car's velocity.
const getRacerWithWheelEmittersPlaced = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  const velocityOffset = getEmitterVelocityOffset(context.arithmetic, racer)
  return racer.vehicle.wheelEmitters.reduce(
    (current, reference, wheelIndex) =>
      placeVehicleEmitter(
        context.arithmetic,
        current,
        reference,
        racer,
        getWheelAnchor(racer, wheelIndex),
        velocityOffset
      ),
    racerSet
  )
}

// 0x0043f1e0: while the tire smoke runs, the wheels' marks follow the ground and the car.
const getRacerAfterSkids = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  stepMilliseconds: number
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  if ((racer.vehicle.flags & TIRE_SMOKE_RUNNING_FLAG) === 0) return racerSet
  return setVehicle(racerSet, racerIndex, (vehicle) => ({
    ...vehicle,
    skids: getSkidsStepped(context.arithmetic, racer, stepMilliseconds),
  }))
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
    ? spawnVehicleEmitter(
        context.arithmetic,
        racerSet,
        true,
        'carland',
        racer.carBody.rigidBody.displayFrame.position
      ).racerSet
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

// 0x0043e33e: the dust, the boost smoke and the tire smoke live on and follow the car: the dust is let go after 9 births,
// the boost smoke after 3; the dust and the tire smoke each draw once for the wheel they sit at.
const updateRunningEmitters = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number
): RacerSet => {
  const { dustEmitter, boostEmitter, tireSmokeEmitter } = getRacer(racerSet, racerIndex).vehicle
  const dusted = ((): RacerSet => {
    if (dustEmitter === null) return racerSet
    if (getIsReferenceExhausted(racerSet, dustEmitter, DUST_MAXIMUM_BORN_COUNT)) {
      return setVehicle(
        releaseVehicleEmitter(racerSet, dustEmitter, false),
        racerIndex,
        (vehicle) => ({ ...vehicle, dustEmitter: null })
      )
    }
    const drawn = drawBit(context, racerSet)
    const racer = getRacer(drawn.racerSet, racerIndex)
    return placeVehicleEmitter(
      context.arithmetic,
      drawn.racerSet,
      dustEmitter,
      racer,
      getDustPosition(racer, drawn.isSet),
      getEmitterVelocityOffset(context.arithmetic, racer)
    )
  })()
  const boosted = ((): RacerSet => {
    if (boostEmitter === null) return dusted
    if (getIsReferenceExhausted(dusted, boostEmitter, BOOST_SMOKE_MAXIMUM_BORN_COUNT)) {
      return setVehicle(
        releaseVehicleEmitter(dusted, boostEmitter, false),
        racerIndex,
        (vehicle) => ({ ...vehicle, boostEmitter: null })
      )
    }
    const racer = getRacer(dusted, racerIndex)
    return placeVehicleEmitter(
      context.arithmetic,
      dusted,
      boostEmitter,
      racer,
      getBoostSmokePosition(context.arithmetic, racer),
      getEmitterVelocityOffset(context.arithmetic, racer)
    )
  })()
  if (tireSmokeEmitter === null) return boosted
  const drawn = drawBit(context, boosted)
  const racer = getRacer(drawn.racerSet, racerIndex)
  return placeVehicleEmitter(
    context.arithmetic,
    drawn.racerSet,
    tireSmokeEmitter,
    racer,
    getTireSmokePosition(racer, drawn.isSet),
    getEmitterVelocityOffset(context.arithmetic, racer)
  )
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

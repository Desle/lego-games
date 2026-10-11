import type { HazardRacer } from '../../../hazard/index.ts'
import { getBrickKindCode, getBrickKindFromCode } from '../../../power-ups/index.ts'
import type {
  PowerUpContext,
  PowerUpEvent,
  PowerUpStep,
  RacerPowerUps,
  RacerPowerUpStatus,
} from '../../../power-ups/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { STATIC_TRACK_WORLD } from '../../../track-logic/index.ts'
import type { TrackEffect, TrackLogicContext, TrackLogicStep } from '../../../track-logic/index.ts'
import { createTrackLineProbe } from '../../../projectiles/index.ts'
import type {
  FlightRacer,
  LineProbe,
  ProjectileContext,
  ProjectileEvent,
} from '../../../projectiles/index.ts'
import { getRacer, getTableCosine, setCarBodyPush, setRacer } from '../../../racer/index.ts'
import type { Racer, RacerControls, RacerSet, RacerSetContext } from '../../../racer/index.ts'
import type { RaceContacts, RaceRacerSet, RaceState } from '../../types/race.types.ts'
import { getLapGapMilliseconds } from '../../types/lap-gap/lap-gap.ts'
import {
  COMPUTER_CONTROLLER,
  enterZoneOne,
  enterZoneTwo,
  enterZoneZero,
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
    surfaces: state.surfaces,
    collisionObjectNames: state.collisionObjectNames,
    taggedPositionMilliseconds: state.taggedPositionMilliseconds,
    registryObjects: state.registryObjects,
    raceModeFlags: state.raceModeFlags,
    pendingContacts: contacts,
    trackLogic: state.trackLogic,
    trackEffects: state.trackEffects,
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
    registryEntries: racerSet.registryEntries,
    registryContacts: racerSet.registryContacts,
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
  arithmetic: FloatArithmetic,
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
        getRacerAfterPowerUpEvent(arithmetic, getRacer(current, racerIndex), event)
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
  return getRacerSetAfterEvents(
    context.arithmetic,
    withRacers,
    changed.events.slice(step.events.length)
  )
}

const NO_LINE_HIT: LineProbe = () => null

// What the moving effects read of a racer. Fields named in projectiles.md: +0x3f0 is the car body's linear velocity
// (+0x8), +0x9e0 and +0x9ec its velocity direction and speed (+0x5f8, +0x604), +0x550 its heading (+0x168), +0xe08 and
// +0xe20 the display frame's position and first row, +0xcc4 the checkpoint. Not ported, so fixed: the vehicle
// object (+0xb2c, absent) and the wand's bend radius (+0x2c, model data, 0).
export const getFlightRacer = (racer: Racer): FlightRacer => {
  const { rigidBody } = racer.carBody
  const { displayFrame } = rigidBody
  const row = Object.freeze({
    x: displayFrame.rotation[0],
    y: displayFrame.rotation[1],
    z: displayFrame.rotation[2],
  })
  return Object.freeze({
    position: displayFrame.position,
    velocity: rigidBody.linearVelocity,
    heading: rigidBody.velocityDirection,
    headingSpeed: rigidBody.speed,
    sideAxis: rigidBody.heading,
    isVehiclePresent: false,
    speed: rigidBody.speed,
    muzzlePosition: displayFrame.position,
    muzzleDirection: row,
    boundingCenter: displayFrame.position,
    boundingRadius: rigidBody.displayBoundingRadius,
    beamRadius: 0,
    routeNodeIndex: racer.checkpointIndex < 0 ? null : racer.checkpointIndex,
    rocketHeading: row,
  })
}

// The line probe 0x0041f730 over the first collision object (the track); the material flag 0x20000 test needs the
// track-material table of the track, which the race does not carry, so no hit is passed through.
export const getProjectileContext = (
  state: RaceState,
  racerSet: RaceRacerSet,
  powerUps: PowerUpContext
): ProjectileContext => {
  const track = state.context.collisionObjects[racerSet.racers[0]?.collisionObjectIndices[0] ?? 0]
  return Object.freeze({
    powerUps,
    racers: Object.freeze(racerSet.racers.map(getFlightRacer)),
    route: state.projectileModelData.routeNodes,
    rocketLaunchMilliseconds: state.projectileModelData.rocketLaunchMilliseconds,
    debrisAnimations: state.projectileModelData.debrisAnimations,
    probe:
      track === undefined
        ? NO_LINE_HIT
        : createTrackLineProbe(state.context.arithmetic, track.volume, () => false),
  })
}

const TUMBLING_STARTED_FLAG = 0x8

// 0x00439570 sets racer flag 0x8; the other events call car body slots that are not ported (they stay in the
// events the race reports).
export const getRacerAfterProjectileEvent = (racer: Racer, event: ProjectileEvent): Racer =>
  event.type === 'projectiles.racer_tumbling_started'
    ? Object.freeze({ ...racer, flags: (racer.flags | TUMBLING_STARTED_FLAG) >>> 0 })
    : racer

export const getRacerSetAfterProjectileEvents = (
  racerSet: RaceRacerSet,
  events: readonly ProjectileEvent[]
): RaceRacerSet =>
  events.reduce((current, event) => {
    if (!('racer' in event) || current.racers[event.racer] === undefined) return current
    return Object.freeze({
      ...current,
      ...setRacer(
        current,
        event.racer,
        getRacerAfterProjectileEvent(getRacer(current, event.racer), event)
      ),
    })
  }, racerSet)

const getHazardRacer = (racer: Racer | undefined, racerIndex: number): HazardRacer | null => {
  if (racer === undefined) return null
  const { position } = racer.carBody.rigidBody.displayFrame
  return Object.freeze({
    index: racerIndex,
    flags: racer.flags,
    position: Object.freeze([position.x, position.y, position.z] as const),
  })
}

const ZONE_ZERO = 0
const ZONE_ONE = 1
const TARGET_SET_FLAG = 0x8000
const FORCE_SLOTS = Object.freeze({
  0x40: 'extraForceA',
  0x44: 'extraForceA',
  0x48: 'extraForceB',
  0x4c: 'extraForceB',
} as const)

export const changeRacer = (
  racerSet: RaceRacerSet,
  racerIndex: number,
  change: (racer: Racer) => Racer
): RaceRacerSet =>
  getRaceRacerSetOf(setRacer(racerSet, racerIndex, change(getRacer(racerSet, racerIndex))))

// 0x00464680 (the zone event of a trigger): the racer enters zone 0 (0x00439b70), 1 (0x00439ba0, the lap line) or 2
// (0x00439c40).
export const getRacerSetInZone = (
  racerSet: RaceRacerSet,
  racerIndex: number,
  zone: number
): RaceRacerSet =>
  changeRacer(racerSet, racerIndex, (racer) => {
    if (zone === ZONE_ZERO) return enterZoneZero(racer)
    if (zone !== ZONE_ONE) return enterZoneTwo(racer)
    return enterZoneOne(racer, (next) =>
      getLapGapMilliseconds(setRacer(racerSet, racerIndex, next), racerIndex, next.lapCount)
    )
  })

// What the track logic's events do to the racers they were fired for: the zone (above), the guidance target
// (0x00439e60 sets racer +0xdf8 and flag 0x8000, 0x00439e90 clears the flag) and the car body's forces (slots 16..19).
const TAGGED_POSITION_MILLISECONDS = 150 // 0x96 at 0x0045e55b
const TAGGED_POSITION_CHUNK_MILLISECONDS = 255
const COLLISION_LIST_CAPACITY = 5

// 0x004488e0: the object joins the racer's collision list unless it is there or the list holds five.
const getListWith = (indices: readonly number[], index: number): readonly number[] =>
  indices.includes(index) || indices.length >= COLLISION_LIST_CAPACITY
    ? indices
    : Object.freeze([...indices, index])

// 0x00448930: the first entry of the object leaves the list, the others keep their order.
const getListWithout = (indices: readonly number[], index: number): readonly number[] => {
  const position = indices.indexOf(index)
  return position === -1
    ? indices
    : Object.freeze([...indices.slice(0, position), ...indices.slice(position + 1)])
}

const getRacerSetWithTaggedPositions = (
  racerSet: RaceRacerSet,
  racerIndex: number,
  instanceIndex: number,
  milliseconds: number
): RaceRacerSet =>
  Object.freeze({
    ...racerSet,
    taggedPositionMilliseconds: Object.freeze(
      racerSet.taggedPositionMilliseconds.map((countdowns, index) =>
        index === racerIndex
          ? Object.freeze(
              countdowns.map((current, instance) =>
                instance === instanceIndex ? milliseconds : current
              )
            )
          : countdowns
      )
    ),
  })

// 0x0045e520 (a racer is inside a trigger that names a collision world instance): the instance joins the racer's
// collision list when it was not already there for this trigger, and stays for another 150 ms.
const getRacerSetWithTaggedPosition = (
  racerSet: RaceRacerSet,
  racerIndex: number,
  triggerIndex: number
): RaceRacerSet => {
  const name = racerSet.trackLogic.triggers.main[triggerIndex]?.definition.objectName
  const instanceIndex =
    name === null || name === undefined ? -1 : racerSet.collisionObjectNames.indexOf(name)
  const countdown = racerSet.taggedPositionMilliseconds[racerIndex]?.[instanceIndex]
  if (countdown === undefined) return racerSet
  const listed =
    countdown === 0
      ? changeRacer(racerSet, racerIndex, (racer) =>
          Object.freeze({
            ...racer,
            collisionObjectIndices: getListWith(racer.collisionObjectIndices, instanceIndex),
          })
        )
      : racerSet
  return getRacerSetWithTaggedPositions(
    listed,
    racerIndex,
    instanceIndex,
    TAGGED_POSITION_MILLISECONDS
  )
}

// 0x0045e470 (once per frame with the frame's time step, from Race_Update): the countdowns run in chunks of at most
// 255 ms; an instance whose countdown ends leaves the racer's collision list (0x00448930).
export const updateTaggedPositions = (
  racerSet: RaceRacerSet,
  stepMilliseconds: number
): RaceRacerSet => {
  let current = racerSet
  for (let remaining = stepMilliseconds; remaining > 0;) {
    const chunk = Math.min(remaining, TAGGED_POSITION_CHUNK_MILLISECONDS)
    current = current.taggedPositionMilliseconds.reduce(
      (outer, countdowns, racerIndex) =>
        countdowns.reduce((inner, countdown, instanceIndex) => {
          if (countdown === 0) return inner
          if (chunk < countdown) {
            return getRacerSetWithTaggedPositions(
              inner,
              racerIndex,
              instanceIndex,
              countdown - chunk
            )
          }
          return changeRacer(
            getRacerSetWithTaggedPositions(inner, racerIndex, instanceIndex, 0),
            racerIndex,
            (racer) =>
              Object.freeze({
                ...racer,
                collisionObjectIndices: getListWithout(racer.collisionObjectIndices, instanceIndex),
              })
          )
        }, outer),
      current
    )
    remaining -= chunk
  }
  return current
}

const getRacerSetAfterTrackEffect = (
  context: RacerSetContext,
  racerSet: RaceRacerSet,
  effect: TrackEffect
): RaceRacerSet => {
  if (effect.type === 'track.racer_zone_entered') {
    return racerSet.racers[effect.racerIndex] === undefined
      ? racerSet
      : getRacerSetInZone(racerSet, effect.racerIndex, effect.zone)
  }
  if (effect.type === 'track.tagged_position_touched') {
    return racerSet.racers[effect.racerIndex] === undefined
      ? racerSet
      : getRacerSetWithTaggedPosition(racerSet, effect.racerIndex, effect.triggerIndex)
  }
  if (effect.type === 'track.racer_target_set') {
    if (racerSet.racers[effect.racerIndex] === undefined) return racerSet
    return changeRacer(racerSet, effect.racerIndex, (racer) =>
      effect.target === null
        ? Object.freeze({ ...racer, flags: (racer.flags & ~TARGET_SET_FLAG) >>> 0 })
        : Object.freeze({
            ...racer,
            flags: (racer.flags | TARGET_SET_FLAG) >>> 0,
            guidanceTarget: Object.freeze({
              x: effect.target[0],
              y: effect.target[1],
              z: effect.target[2],
            }),
          })
    )
  }
  if (effect.type === 'track.racer_force_changed') {
    const slot = FORCE_SLOTS[effect.slot as keyof typeof FORCE_SLOTS]
    if (racerSet.racers[effect.racerIndex] === undefined) return racerSet
    const { vector } = effect
    return changeRacer(racerSet, effect.racerIndex, (racer) =>
      Object.freeze({
        ...racer,
        carBody: setCarBodyPush(
          context.arithmetic,
          racer.carBody,
          slot,
          vector === null ? undefined : Object.freeze({ x: vector[0], y: vector[1], z: vector[2] })
        ),
      })
    )
  }
  return racerSet
}

// Runs a track logic operation on the racer set: the random table position goes in and comes out (the track logic
// shares it with the racers), the effects it asked for are kept for the race to report, and the ones that change a
// racer are applied to it.
export const changeTrackLogic = (
  context: RacerSetContext,
  racerSet: RaceRacerSet,
  run: (trackLogic: RaceRacerSet['trackLogic'], trackContext: TrackLogicContext) => TrackLogicStep
): RaceRacerSet => {
  const synced = {
    ...racerSet.trackLogic,
    random: { table: racerSet.trackLogic.random.table, position: racerSet.randomPosition },
  }
  const track = context.collisionObjects[0]
  const step = run(synced, {
    arithmetic: context.arithmetic,
    world: STATIC_TRACK_WORLD,
    getHazardRacer: (racerIndex) => getHazardRacer(racerSet.racers[racerIndex], racerIndex),
    getTableCosine: (index) => getTableCosine(context.tables, index),
    probe:
      track === undefined
        ? NO_LINE_HIT
        : createTrackLineProbe(context.arithmetic, track.volume, () => false),
  })
  const changed: RaceRacerSet = Object.freeze({
    ...racerSet,
    trackLogic: step.state,
    randomPosition: step.state.random.position,
    trackEffects: Object.freeze([...racerSet.trackEffects, ...step.effects]),
  })
  return step.effects.reduce(
    (current, effect) => getRacerSetAfterTrackEffect(context, current, effect),
    changed
  )
}

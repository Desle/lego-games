import { EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect } from '../../../power-ups/index.ts'
import { BallisticFlightState, ExplosionState } from '../../../projectiles/index.ts'
import type { ExplosionPool } from '../../../projectiles/index.ts'
import { getBoundingInterval } from '../../../racer-collision/index.ts'
import type { BoundingSphere } from '../../../racer-collision/index.ts'
import type { ModelBounds } from '../../../model/index.ts'
import type { RegistryEntry } from '../../../projectiles/index.ts'
import {
  getFloatFromBits,
  getFrameTransformedPoint,
  IDENTITY_MATRIX3,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Frame, Vector3 } from '../../../simulation-math/index.ts'
import {
  touchProjectileExplosions,
  touchProjectileFlights,
  touchProjectileHazards,
} from '../../../projectiles/index.ts'
import type { ProjectileWorld } from '../../../projectiles/index.ts'
import type { RacerSetContext } from '../../../racer/index.ts'
import {
  changePowerUps,
  createProjectileContext,
  getPowerUpContext,
  getRaceRacerSetOf,
  getRacerSetAfterProjectileEvents,
} from '../race-world/race-world.ts'
import type { RaceRacerSet, RegistryObject, RegistrySource } from '../../types/race.types.ts'

// The cannon ball's shape radius, read from the emulator ('@@cannon' is a built-in model). The grapple hook, the
// barrel and the missile take theirs from their models' bounds (GRAPPLE, BARREL, DMISSILE), which agree with the
// emulator to the last printed digit.
const CANNON_BALL_RADIUS = getFloatFromBits(0x40624630)
// 0x004573a0 sets 3.0 on the slick's sphere, 0x004560b0 and 0x00452ae0 set 10.0 (0x004b13f0 and its neighbour).
const OIL_SLICK_RADIUS = 3
const WIDE_HAZARD_RADIUS = 10
// The magnet hangs this high above the ground point its sphere sits on (0x004b15f0).
const MAGNET_HEIGHT = 30
// 0x00429xxx registrations: type 4, flags 1, no call limit, no interval.
const REGISTRATION_FLAGS = 0x1

const FIGURE_SCALE = 1

const ORIGIN_SPHERE: BoundingSphere = Object.freeze({ centre: ZERO_VECTOR3, radius: 0 })

const getSphere = (centre: Vector3, radius: number): BoundingSphere =>
  Object.freeze({ centre, radius })

// 0x0040e0b0 for a figure that does not play (flag 0x10000 clear): the model's bounds centre and radius times the figure's
// scale (+0x58, 1 here), the centre carried through the figure's frame (slot +0x2c).
const getFigureSphere = (
  arithmetic: FloatArithmetic,
  frame: Frame,
  bounds: ModelBounds
): BoundingSphere => {
  const { multiply, storeFloat } = arithmetic
  const scaled = Object.freeze({
    x: storeFloat(multiply(FIGURE_SCALE, bounds.centre.x)),
    y: storeFloat(multiply(FIGURE_SCALE, bounds.centre.y)),
    z: storeFloat(multiply(FIGURE_SCALE, bounds.centre.z)),
  })
  return getSphere(
    getFrameTransformedPoint(arithmetic, frame, scaled),
    storeFloat(multiply(FIGURE_SCALE, bounds.radius))
  )
}

const getEffectOf = (source: RegistrySource, effectId: number): PowerUpEffect | undefined =>
  source.powerUpStep.world.effects.effects[effectId]

const getFlightSphere = (source: RegistrySource, effect: PowerUpEffect): BoundingSphere => {
  const motion = source.projectileWorld.motions[effect.id]
  if (motion === undefined || motion === null) return ORIGIN_SPHERE
  if (motion.kind === 'ballistic') {
    if (effect.kind === PowerUpEffectKind.BARREL) {
      return getFigureSphere(
        source.arithmetic,
        {
          rotation: source.projectileWorld.barrelSpins[effect.id]?.rotation ?? IDENTITY_MATRIX3,
          position: motion.flight.framePosition,
        },
        source.projectileModelData.shapeBounds.barrel
      )
    }
    return getSphere(motion.flight.framePosition, CANNON_BALL_RADIUS)
  }
  const { shapeBounds } = source.projectileModelData
  if (motion.kind === 'grapple') {
    return getFigureSphere(
      source.arithmetic,
      source.projectileWorld.hookFrame,
      shapeBounds.grapple
    )
  }
  if (motion.kind === 'rocket' && motion.homing !== null) {
    return getFigureSphere(
      source.arithmetic,
      { rotation: motion.frameRotation, position: motion.homing.flight.framePosition },
      shapeBounds.rocket
    )
  }
  return ORIGIN_SPHERE
}

const getHazardSphere = (source: RegistrySource, effect: PowerUpEffect): BoundingSphere => {
  const motion = source.projectileWorld.motions[effect.id]
  if (motion === undefined || motion === null) return ORIGIN_SPHERE
  if (motion.kind === 'hazard') {
    return getSphere(
      motion.position,
      effect.kind === PowerUpEffectKind.OIL_SLICK ? OIL_SLICK_RADIUS : WIDE_HAZARD_RADIUS
    )
  }
  if (motion.kind === 'magnet') {
    return getSphere(
      Object.freeze({ ...motion.position, z: motion.position.z - MAGNET_HEIGHT }),
      WIDE_HAZARD_RADIUS
    )
  }
  return ORIGIN_SPHERE
}

// The sphere of a registered power-up object: the shape the original's entry points at.
export const getProjectileRegistrySphere = (
  source: RegistrySource,
  object: RegistryObject
): BoundingSphere => {
  if (object.type === 'effect_flight' || object.type === 'effect_hazard') {
    const effect = getEffectOf(source, object.effectId)
    if (effect === undefined) return ORIGIN_SPHERE
    return object.type === 'effect_flight'
      ? getFlightSphere(source, effect)
      : getHazardSphere(source, effect)
  }
  if (object.type !== 'explosion') return ORIGIN_SPHERE
  const pool = object.isSpiked
    ? source.projectileWorld.spikedExplosions
    : source.projectileWorld.explosions
  const explosion = pool.explosions[object.index]
  return explosion === undefined ? ORIGIN_SPHERE : getSphere(explosion.position, explosion.scale)
}

const getIsLive = (effect: PowerUpEffect): boolean =>
  effect.state === EffectState.ACTIVE ||
  effect.state === EffectState.ENDING ||
  effect.state === EffectState.FINAL_STAGE

const getIsFlightRegistered = (source: RegistrySource, effect: PowerUpEffect): boolean => {
  const motion = source.projectileWorld.motions[effect.id]
  if (motion === undefined || motion === null || !getIsLive(effect)) return false
  switch (effect.kind) {
    case PowerUpEffectKind.CANNON:
      return motion.kind === 'ballistic'
    case PowerUpEffectKind.BARREL:
      // 0x00452ff0 lets the body go (0x00431530) in the update that sees its flight end; a racer's touch only marks it.
      return motion.kind === 'ballistic' && motion.flight.state !== BallisticFlightState.IDLE
    case PowerUpEffectKind.GRAPPLE:
      return motion.kind === 'grapple' && !motion.hook.isRetracting
    case PowerUpEffectKind.ROCKET:
      return motion.kind === 'rocket' && motion.homing !== null
    default:
      return false
  }
}

const getIsHazardRegistered = (source: RegistrySource, effect: PowerUpEffect): boolean => {
  const motion = source.projectileWorld.motions[effect.id]
  if (motion === undefined || motion === null) return false
  if (effect.kind === PowerUpEffectKind.MAGNET) {
    return motion.kind === 'magnet' && effect.state !== EffectState.FINISHED
  }
  return (
    (effect.kind === PowerUpEffectKind.OIL_SLICK || effect.kind === PowerUpEffectKind.CURSE) &&
    motion.kind === 'hazard' &&
    getIsLive(effect)
  )
}

const getExplosionObjects = (pool: ExplosionPool, isSpiked: boolean): readonly RegistryObject[] =>
  pool.activeIndices.flatMap((index) =>
    pool.explosions[index]?.state !== ExplosionState.GROWING
      ? []
      : [{ type: 'explosion', isSpiked, index } as const]
  )

// The objects the original has registered now, in the order they registered: the effects in the order the power-ups
// update them, then the explosions they started.
const getRegisteredObjects = (source: RegistrySource): readonly RegistryObject[] => {
  const { effects, activeEffectIds } = source.powerUpStep.world.effects
  const fromEffects = activeEffectIds.flatMap((effectId): readonly RegistryObject[] => {
    const effect = effects[effectId]
    if (effect === undefined) return []
    return [
      ...(getIsFlightRegistered(source, effect)
        ? [{ type: 'effect_flight', effectId } as const]
        : []),
      ...(getIsHazardRegistered(source, effect)
        ? [{ type: 'effect_hazard', effectId } as const]
        : []),
    ]
  })
  return [
    ...fromEffects,
    ...getExplosionObjects(source.projectileWorld.explosions, false),
    ...getExplosionObjects(source.projectileWorld.spikedExplosions, true),
  ]
}

const getIsSameObject = (left: RegistryObject, right: RegistryObject): boolean => {
  if (left.type === 'effect_flight' || left.type === 'effect_hazard') {
    return right.type === left.type && right.effectId === left.effectId
  }
  if (left.type === 'explosion') {
    return (
      right.type === 'explosion' && right.isSpiked === left.isSpiked && right.index === left.index
    )
  }
  return false
}

const getEntryFor = (
  arithmetic: FloatArithmetic,
  source: RegistrySource,
  object: RegistryObject,
  id: number
): RegistryEntry => {
  const interval = getBoundingInterval(arithmetic, getProjectileRegistrySphere(source, object))
  return Object.freeze({
    id,
    flags: REGISTRATION_FLAGS,
    maximumCalls: 0,
    interval: 0,
    calls: 0,
    ticks: 0,
    isActive: true,
    minimumExtent: interval.minimum,
    maximumExtent: interval.maximum,
  })
}

// 0x0042fb50 for the objects that launched since the last call (each is put at the head of the list) and the entry
// end (+0x24 = 0) of the ones that finished.
export const getRacerSetWithProjectileRegistry = (
  arithmetic: FloatArithmetic,
  racerSet: RaceRacerSet
): RaceRacerSet => {
  const wanted = getRegisteredObjects(racerSet)
  const isDynamic = (object: RegistryObject | undefined): boolean =>
    object !== undefined &&
    (object.type === 'effect_flight' ||
      object.type === 'effect_hazard' ||
      object.type === 'explosion')
  const liveIds = new Set(
    racerSet.registryEntries
      .filter((entry) => entry.isActive && isDynamic(racerSet.registryObjects[entry.id]))
      .map((entry) => entry.id)
  )
  const keptIds = new Set(
    [...liveIds].filter((id) => {
      const object = racerSet.registryObjects[id]
      return object !== undefined && wanted.some((candidate) => getIsSameObject(candidate, object))
    })
  )
  const ended = racerSet.registryEntries.map((entry) =>
    liveIds.has(entry.id) && !keptIds.has(entry.id)
      ? Object.freeze({ ...entry, isActive: false })
      : entry
  )
  const fresh = wanted.filter(
    (object) =>
      ![...keptIds].some((id) => {
        const kept = racerSet.registryObjects[id]
        return kept !== undefined && getIsSameObject(kept, object)
      })
  )
  const objects = [...racerSet.registryObjects, ...fresh]
  const entries = fresh.reduce<readonly RegistryEntry[]>(
    (current, object, position) => [
      getEntryFor(arithmetic, racerSet, object, racerSet.registryObjects.length + position),
      ...current,
    ],
    ended
  )
  return fresh.length === 0 && liveIds.size === keptIds.size
    ? racerSet
    : Object.freeze({
        ...racerSet,
        registryObjects: Object.freeze(objects),
        registryEntries: Object.freeze(entries),
      })
}

const getRacerSetWithWorld = (racerSet: RaceRacerSet, world: ProjectileWorld): RaceRacerSet =>
  Object.freeze({ ...racerSet, projectileWorld: world })

// The listener of a registered power-up object answers a racer it touches (0x00431660, 0x00456320, 0x00421c00); what
// it asks of the racer's car body is applied at once.
export const getRacerSetAfterProjectileContact = (
  context: RacerSetContext,
  racerSet: RaceRacerSet,
  object: RegistryObject,
  racerIndex: number
): RaceRacerSet => {
  const eventCount = racerSet.projectileWorld.events.length
  const getContext = (racers: RaceRacerSet) =>
    createProjectileContext(
      context,
      racers.projectileModelData,
      racers,
      getPowerUpContext(context, racers)
    )
  let touched = racerSet
  if (object.type === 'effect_flight') {
    touched = getRacerSetWithWorld(
      racerSet,
      touchProjectileFlights(racerSet.projectileWorld, getContext(racerSet), [
        { effect: object.effectId, racer: racerIndex },
      ])
    )
  } else if (object.type === 'effect_hazard') {
    let world = racerSet.projectileWorld
    const stepped = changePowerUps(context, racerSet, (step, powerUpContext) => {
      const result = touchProjectileHazards(
        step,
        racerSet.projectileWorld,
        createProjectileContext(context, racerSet.projectileModelData, racerSet, powerUpContext),
        [{ effect: object.effectId, racer: racerIndex }]
      )
      world = result.world
      return result.step
    })
    touched = getRacerSetWithWorld(getRaceRacerSetOf(stepped), world)
  } else if (object.type === 'explosion') {
    touched = getRacerSetWithWorld(
      racerSet,
      touchProjectileExplosions(racerSet.projectileWorld, getContext(racerSet), [
        { isSpiked: object.isSpiked, explosion: object.index, racer: racerIndex },
      ])
    )
  }
  return getRacerSetAfterProjectileEvents(
    context.arithmetic,
    touched,
    touched.projectileWorld.events.slice(eventCount)
  )
}

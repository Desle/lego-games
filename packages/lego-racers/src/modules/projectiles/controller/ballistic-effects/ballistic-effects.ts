import {
  endProjectileFlight,
  getEffect,
  hitRacerWithProjectile,
  type PowerUpEffect,
  type PowerUpStep,
} from '../../../power-ups/index.ts'
import { getNormalizedVector3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import {
  advanceBallisticFlight,
  BallisticFlightState,
  createBallisticFlight,
  getFlightVelocity,
  launchFlightAtPoint,
  launchFlightAtRacer,
  reflectBallisticFlight,
} from '../../types/ballistic-flight/ballistic-flight.ts'
import type {
  BallisticFlight,
  BallisticFlightState as BallisticFlightStateValue,
  BallisticLaunchParameters,
} from '../../types/ballistic-flight/ballistic-flight.types.ts'
import type { FlightRacer } from '../../types/projectiles.types.ts'
import { getMotion, getWorldWithMotion } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'

// 0x004b1394 and 0xc200b439 in 0x00453240: the gravity of both arcs, -32.176.
const FLIGHT_GRAVITY = Math.fround(-32.176)
// 0x004b13e4: a ground hit whose normal points up more than this makes a ground burst (0x00451b50).
const GROUND_BURST_MINIMUM_NORMAL_Z = Math.fround(0.7071)
const MAXIMUM_FLIGHT_MILLISECONDS = 3000

// 0x00451f50: the cannonball's parameter block.
const CANNON_PARAMETERS: BallisticLaunchParameters = Object.freeze({
  gravity: FLIGHT_GRAVITY,
  // 0x004b1398.
  speed: 180,
  targetOffset: ZERO_VECTOR3,
  maximumDurationMilliseconds: MAXIMUM_FLIGHT_MILLISECONDS,
  // 0x004b13b4.
  heightOffset: 5,
})
// 0x004b139c and 0x004b1370: without a target the cannon fires 500 units ahead and 5 up.
const CANNON_AHEAD_DISTANCE = 500
const CANNON_AHEAD_HEIGHT = 5

// 0x00453240 case 2: the barrel's parameter block.
const BARREL_PARAMETERS: BallisticLaunchParameters = Object.freeze({
  gravity: FLIGHT_GRAVITY,
  speed: 40,
  targetOffset: ZERO_VECTOR3,
  maximumDurationMilliseconds: MAXIMUM_FLIGHT_MILLISECONDS,
  // 0x004b1424.
  heightOffset: 5,
})
// 0x004b147c and 0x004b1424: without a target the barrel is thrown 90 units behind and 5 up.
const BARREL_BEHIND_DISTANCE = -90
const BARREL_BEHIND_HEIGHT = 5

export class UnknownProjectileRacerError extends Error {
  constructor(racer: number) {
    super(`No racer at index ${String(racer)}`)
    this.name = 'UnknownProjectileRacerError'
  }
}

export class MissingProjectileOwnerError extends Error {
  constructor(effectId: number) {
    super(`Effect ${String(effectId)} has no owner racer; launcher-owned flights are not ported`)
    this.name = 'MissingProjectileOwnerError'
  }
}

const getFlightRacer = (context: ProjectileContext, racer: number): FlightRacer => {
  const flightRacer = context.racers[racer]
  if (flightRacer === undefined) throw new UnknownProjectileRacerError(racer)
  return flightRacer
}

const getOwner = (effect: PowerUpEffect): number => {
  if (effect.ownerRacer === null) throw new MissingProjectileOwnerError(effect.id)
  return effect.ownerRacer
}

// The point 0x00451f50 and 0x00453240 aim at when there is no racer: the owner's frame position moved along its
// forward axis (frame +0x28..+0x30) by the distance, and raised by the height on z.
const getPointAlongForward = (
  context: ProjectileContext,
  owner: number,
  distance: number,
  height: number
): Vector3 => {
  const { add, multiply, storeFloat } = context.powerUps.arithmetic
  const status = context.powerUps.racers[owner]
  if (status === undefined) throw new UnknownProjectileRacerError(owner)
  return Object.freeze({
    x: storeFloat(add(multiply(distance, status.forward.x), status.position.x)),
    y: storeFloat(add(multiply(distance, status.forward.y), status.position.y)),
    z: storeFloat(add(add(multiply(distance, status.forward.z), status.position.z), height)),
  })
}

// 0x00451f50 case 2 (the cannon leaves state 2): a flight from the owner at the target racer, the track point or
// the point ahead.
export const getCannonFlight = (
  context: ProjectileContext,
  effect: PowerUpEffect
): BallisticFlight => {
  const owner = getOwner(effect)
  const flight = createBallisticFlight()
  if (effect.targetRacer !== null) {
    return launchFlightAtRacer(context.powerUps.arithmetic, flight, CANNON_PARAMETERS, {
      shooter: owner,
      shooterRacer: getFlightRacer(context, owner),
      target: effect.targetRacer,
      targetRacer: getFlightRacer(context, effect.targetRacer),
      isFromShooter: true,
      isLeadLimited: false,
    })
  }
  const trackPoint =
    effect.targetTrackPoint === null
      ? undefined
      : context.powerUps.trackTargets[effect.targetTrackPoint]
  return launchFlightAtPoint(context.powerUps.arithmetic, flight, CANNON_PARAMETERS, {
    shooter: owner,
    shooterRacer: getFlightRacer(context, owner),
    point:
      trackPoint === undefined
        ? getPointAlongForward(context, owner, CANNON_AHEAD_DISTANCE, CANNON_AHEAD_HEIGHT)
        : trackPoint.position,
    pointVelocity: ZERO_VECTOR3,
    isFromShooter: true,
  })
}

// 0x00453240 case 2 (the barrel leaves state 2): thrown at the target racer (limited lead) or behind the owner.
export const getBarrelFlight = (
  context: ProjectileContext,
  effect: PowerUpEffect
): BallisticFlight => {
  const owner = getOwner(effect)
  const flight = createBallisticFlight()
  if (effect.targetRacer !== null) {
    return launchFlightAtRacer(context.powerUps.arithmetic, flight, BARREL_PARAMETERS, {
      shooter: owner,
      shooterRacer: getFlightRacer(context, owner),
      target: effect.targetRacer,
      targetRacer: getFlightRacer(context, effect.targetRacer),
      isFromShooter: true,
      isLeadLimited: true,
    })
  }
  return launchFlightAtPoint(context.powerUps.arithmetic, flight, BARREL_PARAMETERS, {
    shooter: owner,
    shooterRacer: getFlightRacer(context, owner),
    point: getPointAlongForward(context, owner, BARREL_BEHIND_DISTANCE, BARREL_BEHIND_HEIGHT),
    pointVelocity: ZERO_VECTOR3,
    isFromShooter: true,
  })
}

const getWithFlight = (
  step: PowerUpStep,
  world: ProjectileWorld,
  effectId: number,
  flight: BallisticFlight
): ProjectileStep =>
  Object.freeze({
    step,
    world: getWorldWithMotion(world, effectId, Object.freeze({ kind: 'ballistic', flight })),
  })

// The direction the debris leaves a hit racer in: against the horizontal flight direction (0x00451b50 calls
// 0x004316a0 for the velocity, negates x and y, clears z and normalizes with 0x004492d0).
const getDebrisDirection = (context: ProjectileContext, flight: BallisticFlight): Vector3 => {
  const velocity = getFlightVelocity(context.powerUps.arithmetic, flight)
  return getNormalizedVector3(
    context.powerUps.arithmetic,
    Object.freeze({ x: -velocity.x, y: -velocity.y, z: 0 })
  )
}

const getIsReflecting = (context: ProjectileContext, racer: number): boolean => {
  const status = context.powerUps.racers[racer]
  return status !== undefined && status.isShielded && status.shieldLevel > 1
}

// The cannonball (0x00451b50) after its flight advanced: a racer hit, a ground hit or the end of its time.
export const getStepAfterCannonAdvance = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  effectId: number,
  flight: BallisticFlight,
  result: BallisticFlightStateValue
): ProjectileStep => {
  if (result === BallisticFlightState.FLYING) return getWithFlight(step, world, effectId, flight)
  if (result === BallisticFlightState.TOUCHED_RACER && flight.touchedRacer !== null) {
    const victim = flight.touchedRacer
    const effect = getEffect(step, effectId)
    const hitStep = hitRacerWithProjectile(
      step,
      context.powerUps,
      effectId,
      victim,
      getDebrisDirection(context, flight)
    )
    const reflected = getIsReflecting(context, victim)
      ? reflectBallisticFlight(
          context.powerUps.arithmetic,
          flight,
          victim,
          effect.ownerRacer === null ? null : getFlightRacer(context, effect.ownerRacer)
        )
      : flight
    return getWithFlight(hitStep, world, effectId, reflected)
  }
  const isGroundBurst =
    result === BallisticFlightState.HIT_GROUND && flight.hitNormal.z > GROUND_BURST_MINIMUM_NORMAL_Z
  return getWithFlight(
    endProjectileFlight(step, context.powerUps, effectId, isGroundBurst),
    world,
    effectId,
    flight
  )
}

// The barrel (0x00452ff0) after its flight advanced: any end is a ground-type detonation with a 500 ms last stage.
export const getStepAfterBarrelAdvance = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  effectId: number,
  flight: BallisticFlight,
  result: BallisticFlightStateValue
): ProjectileStep => {
  if (result === BallisticFlightState.FLYING) return getWithFlight(step, world, effectId, flight)
  return getWithFlight(
    endProjectileFlight(step, context.powerUps, effectId, true),
    world,
    effectId,
    Object.freeze({ ...flight, state: BallisticFlightState.IDLE })
  )
}

// 0x00431550 for the flight an effect holds, with the elapsed time the effect's update leaves it.
export const advanceEffectFlight = (
  context: ProjectileContext,
  world: ProjectileWorld,
  effectId: number,
  stepMilliseconds: number
): { readonly flight: BallisticFlight; readonly result: BallisticFlightStateValue } | null => {
  const motion = getMotion(world, effectId)
  if (motion === null || motion.kind !== 'ballistic') return null
  const advance = advanceBallisticFlight(
    context.powerUps.arithmetic,
    context.probe,
    motion.flight,
    stepMilliseconds
  )
  return Object.freeze({ flight: advance.flight, result: advance.result })
}

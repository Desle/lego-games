import { EffectState, getEffect, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import {
  getBallTrailRing,
  pushTrailRing,
  releaseTrail,
  stepTrailPool,
  takeTrail,
} from '../../../projectile-trail/index.ts'
import type { TrailParameters, TrailRing } from '../../../projectile-trail/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import { getFlightVelocity } from '../../types/ballistic-flight/ballistic-flight.ts'
import { getMotion, getWorldWithTrail } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'

// 0x004b1384.. (0x00451f50) and 0x00456db0: the parameter blocks the cannon and the rocket start their trail with, the
// colours at 0x004c1c4c and 0x004c1c64 and the fade 0.1 (0x3dcccccd); the ring is 3 wide for the ball (0x004b13a4) and 1
// for the rocket (0x004b167c).
const TRAIL_FADE_FACTOR = getFloatFromBits(0x3dcccccd)
const CANNON_TRAIL: TrailParameters = Object.freeze({
  durationMilliseconds: 300,
  ringSize: 4,
  verticesPerRing: 4,
  fadeFactor: TRAIL_FADE_FACTOR,
  alphaReduction: 0,
  color: Object.freeze({ red: 0x32, green: 0x32, blue: 0x32, alpha: 0xc8 }),
  materialName: 'canstrk',
})
const ROCKET_TRAIL: TrailParameters = Object.freeze({
  durationMilliseconds: 400,
  ringSize: 4,
  verticesPerRing: 4,
  fadeFactor: TRAIL_FADE_FACTOR,
  alphaReduction: 0,
  color: Object.freeze({ red: 0xff, green: 0xff, blue: 0xff, alpha: 0xc8 }),
  materialName: 'mslstrk',
})
const CANNON_RING_SIZE = getFloatFromBits(0x40400000)
const ROCKET_RING_SIZE = getFloatFromBits(0x3f800000)

const getTrailParameters = (kind: PowerUpEffect['kind']): TrailParameters | null => {
  switch (kind) {
    case PowerUpEffectKind.CANNON:
      return CANNON_TRAIL
    case PowerUpEffectKind.ROCKET:
      return ROCKET_TRAIL
    default:
      return null
  }
}

// The ring of the ball or rocket where it is after its update (the tails of 0x00451b50 and 0x004568f0).
const getEffectRing = (
  world: ProjectileWorld,
  context: ProjectileContext,
  effect: PowerUpEffect
): TrailRing | null => {
  const motion = getMotion(world, effect.id)
  if (motion === null) return null
  if (motion.kind === 'ballistic') {
    return getBallTrailRing(
      motion.flight.framePosition,
      getFlightVelocity(context.powerUps.arithmetic, motion.flight),
      CANNON_RING_SIZE
    )
  }
  if (motion.kind === 'rocket' && motion.homing !== null) {
    return getBallTrailRing(
      motion.homing.flight.framePosition,
      motion.homing.velocity,
      ROCKET_RING_SIZE
    )
  }
  return null
}

// 0x00451b50 flies the cannon on with the time left after its countdown; 0x004568f0 hands the rocket the whole step.
const getTrailMilliseconds = (effect: PowerUpEffect, stepMilliseconds: number): number =>
  effect.kind === PowerUpEffectKind.CANNON && stepMilliseconds >= effect.timerMilliseconds
    ? stepMilliseconds - effect.timerMilliseconds
    : stepMilliseconds

// The cannon's and rocket's trail: taken as the effect leaves state 2 (0x00451f50, 0x00456db0) and fed a ring every
// update it is in state 3.
export const getWorldWithTrailFed = (
  world: ProjectileWorld,
  step: PowerUpStep,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileWorld => {
  const parameters = getTrailParameters(before.kind)
  if (parameters === null) return world
  const after = getEffect(step, before.id)
  const isLaunching = before.state === EffectState.STARTING && after.state === EffectState.ACTIVE
  const taken = isLaunching ? takeTrail(world.trails, parameters) : null
  const trails = taken === null ? world.trails : taken.pool
  const trailIndex = taken === null ? (world.effectTrails[before.id] ?? null) : taken.index
  const ring =
    after.state === EffectState.ACTIVE && trailIndex !== null
      ? getEffectRing(world, context, after)
      : null
  return getWorldWithTrail(
    world,
    ring === null || trailIndex === null
      ? trails
      : pushTrailRing(trails, trailIndex, getTrailMilliseconds(before, stepMilliseconds), ring),
    before.id,
    trailIndex
  )
}

// 0x00451ad0, 0x00451f50, 0x004568a0 and 0x00456db0: an effect that is no longer in state 3 lets go of its trail.
export const getWorldWithTrailsReleased = (
  world: ProjectileWorld,
  step: PowerUpStep
): ProjectileWorld =>
  world.effectTrails.reduce<ProjectileWorld>((current, trailIndex, effectId) => {
    if (trailIndex === null || getEffect(step, effectId).state === EffectState.ACTIVE)
      return current
    return getWorldWithTrail(current, releaseTrail(current.trails, trailIndex), effectId, null)
  }, world)

// 0x00493a20 (Race_Update, right after the power-ups).
export const getWorldWithTrailsStepped = (
  world: ProjectileWorld,
  milliseconds: number
): ProjectileWorld => Object.freeze({ ...world, trails: stepTrailPool(world.trails, milliseconds) })

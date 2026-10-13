import { EffectState, getEffect, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import {
  getBallTrailRing,
  pushTrailRing,
  releaseTrail,
  stepTrailPool,
  takeTrail,
} from '../../../projectile-trail/index.ts'
import type { TrailColor, TrailParameters, TrailRing } from '../../../projectile-trail/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import { getFlightVelocity } from '../../types/ballistic-flight/ballistic-flight.ts'
import { getMotion, getWorldWithTrail } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'

// float32 0.1 pushed into the cannon's block at 0x00451fe0 and the rocket's at 0x00456e40
const TRAIL_FADE_FACTOR = getFloatFromBits(0x3dcccccd)
// 0x00451f50 (block at 0x00451fc0): 300 ms, 4 rings, 4 points; the colour is 0x004c1c4c (32 32 32 c8)
const CANNON_DURATION_MILLISECONDS = 300
const CANNON_RING_COUNT = 4 // block word 1 and 2 at 0x00451fc0
const CANNON_COLOR: TrailColor = Object.freeze({
  red: 0x32, // bytes of 0x004c1c4c
  green: 0x32, // 0x004c1c4d
  blue: 0x32, // 0x004c1c4e
  alpha: 0xc8, // @check-allow traced-constants: the colour block 0x004c1c4c is 32 32 32 c8
})
// 0x00456db0 (block at 0x00456e20): 400 ms, 4 rings, 4 points; the colour is 0x004c1c64 (ff ff ff c8)
const ROCKET_DURATION_MILLISECONDS = 400
const ROCKET_COLOR: TrailColor = Object.freeze({
  red: 0xff,
  green: 0xff,
  blue: 0xff,
  alpha: 0xc8, // @check-allow traced-constants: the colour block 0x004c1c64 is ff ff ff c8
})
const CANNON_TRAIL: TrailParameters = Object.freeze({
  durationMilliseconds: CANNON_DURATION_MILLISECONDS,
  ringSize: CANNON_RING_COUNT,
  verticesPerRing: CANNON_RING_COUNT,
  fadeFactor: TRAIL_FADE_FACTOR,
  alphaReduction: 0,
  color: CANNON_COLOR,
  materialName: 'canstrk',
})
const ROCKET_TRAIL: TrailParameters = Object.freeze({
  durationMilliseconds: ROCKET_DURATION_MILLISECONDS,
  ringSize: CANNON_RING_COUNT,
  verticesPerRing: CANNON_RING_COUNT,
  fadeFactor: TRAIL_FADE_FACTOR,
  alphaReduction: 0,
  color: ROCKET_COLOR,
  materialName: 'mslstrk',
})
// float32 3.0 at 0x004b13a4: the cannon's ring is 3 wide and tall
const CANNON_RING_SIZE = getFloatFromBits(0x40400000)
// float32 1.0 at 0x004b167c: the rocket's ring is 1 wide and tall
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

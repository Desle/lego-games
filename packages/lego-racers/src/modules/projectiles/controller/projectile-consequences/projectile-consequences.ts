import { getEffect, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { getThrownDebris, getUpdatedDebris } from '../../types/debris/debris.ts'
import {
  getPoolWithExplosion,
  getRecycledPool,
  getUpdatedExplosion,
} from '../../types/explosion/explosion.ts'
import type { ExplosionPool } from '../../types/explosion/explosion.types.ts'
import type { ExplosionEvent } from './projectile-consequences.types.ts'
import { getMotion } from '../../types/projectile-world/projectile-world.ts'
import type {
  EffectMotion,
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'

// Where the projectile that raised an explosion ended: the barrel's model position (0x00452ff0 reads the frame, or
// the hit point), the others' end position (effect +0x58, the body's +0x28).
const getExplosionBase = (
  motion: EffectMotion | null,
  kind: PowerUpEffect['kind']
): Vector3 | null => {
  if (motion === null) return null
  if (motion.kind === 'ballistic') {
    return kind === PowerUpEffectKind.BARREL
      ? motion.flight.framePosition
      : motion.flight.endPosition
  }
  if (motion.kind === 'rocket') return motion.homing?.flight.endPosition ?? null
  return null
}

const getStepWithExplosion = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  event: ExplosionEvent
): ProjectileStep => {
  const effect = getEffect(step, event.effect)
  const base = getExplosionBase(getMotion(world, event.effect), effect.kind)
  if (base === null) return Object.freeze({ step, world })
  const { add } = context.powerUps.arithmetic
  const position = Object.freeze({
    x: effect.kind === PowerUpEffectKind.BARREL ? add(event.offset.x, base.x) : base.x,
    y: effect.kind === PowerUpEffectKind.BARREL ? add(event.offset.y, base.y) : base.y,
    z: base.z,
  })
  const pool = event.isSpiked ? world.spikedExplosions : world.explosions
  const spawned = getPoolWithExplosion(
    context.powerUps.arithmetic,
    pool,
    position,
    event.isGroundHit,
    effect.ownerRacer
  )
  return Object.freeze({
    step,
    world: Object.freeze(
      event.isSpiked ? { ...world, spikedExplosions: spawned } : { ...world, explosions: spawned }
    ),
  })
}

// What the power-ups events of one effect's update start in the projectiles' world: its explosions
// (0x0045b470, 0x0045b4f0) and the debris pieces of a hit racer (0x0045b550 → 0x004517c0).
export const getStepWithConsequences = (
  current: ProjectileStep,
  previousEventCount: number,
  context: ProjectileContext
): ProjectileStep =>
  current.step.events.slice(previousEventCount).reduce<ProjectileStep>((state, event) => {
    if (event.type === 'power_ups.explosion') {
      return getStepWithExplosion(state.step, state.world, context, event)
    }
    if (event.type !== 'power_ups.debris_thrown') return state
    return event.directions.reduce<ProjectileStep>((thrown, _direction) => {
      const piece = getThrownDebris(thrown.step, thrown.world.debris, context.debrisAnimations)
      return Object.freeze({
        step: piece.step,
        world: Object.freeze({ ...thrown.world, debris: piece.pool }),
      })
    }, state)
  }, current)

const getUpdatedPool = (
  context: ProjectileContext,
  pool: ExplosionPool,
  stepMilliseconds: number
): ExplosionPool =>
  getRecycledPool(
    Object.freeze({
      ...pool,
      explosions: Object.freeze(
        pool.explosions.map((explosion) =>
          getUpdatedExplosion(context.powerUps.arithmetic, explosion, stepMilliseconds)
        )
      ),
    })
  )

// The part of PowerUps_Update 0x0045a490 between the effects and the recycling: explosions (0x004217d0) and debris
// (0x00451860). Only active explosions are updated; an idle one in the pool stays idle.
export const getStepWithExplosionsAndDebris = (
  current: ProjectileStep,
  context: ProjectileContext,
  stepMilliseconds: number
): ProjectileStep => {
  const explosions = getUpdatedPool(context, current.world.explosions, stepMilliseconds)
  const spikedExplosions = getUpdatedPool(context, current.world.spikedExplosions, stepMilliseconds)
  const debris = getUpdatedDebris(current.step, current.world.debris, stepMilliseconds)
  return Object.freeze({
    step: debris.step,
    world: Object.freeze({
      ...current.world,
      explosions,
      spikedExplosions,
      debris: debris.pool,
    }),
  })
}

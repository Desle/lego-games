import { EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import { IDENTITY_MATRIX3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import { NO_BARREL_SPIN } from '../barrel-spin/barrel-spin.ts'
import type { BarrelSpin } from '../barrel-spin/barrel-spin.types.ts'
import { createDebrisPool } from '../debris/debris.ts'
import {
  createExplosionPool,
  NORMAL_EXPLOSION_COUNT,
  NORMAL_EXPLOSION_PARAMETERS,
  SPIKED_EXPLOSION_COUNT,
  SPIKED_EXPLOSION_PARAMETERS,
} from '../explosion/explosion.ts'
import type { ProjectileEvent } from '../projectile-event/projectile-event.types.ts'
import type { EffectMotion, ProjectileWorld } from './projectile-world.types.ts'

export const createProjectileWorld = (step: PowerUpStep): ProjectileWorld =>
  Object.freeze({
    motions: Object.freeze(step.world.effects.effects.map(() => null)),
    rocketWobbleAngles: Object.freeze(step.world.effects.effects.map(() => 0)),
    hookFrame: Object.freeze({ rotation: IDENTITY_MATRIX3, position: ZERO_VECTOR3 }),
    barrelSpins: Object.freeze(step.world.effects.effects.map(() => NO_BARREL_SPIN)),
    events: Object.freeze([]),
    explosions: createExplosionPool(NORMAL_EXPLOSION_COUNT, NORMAL_EXPLOSION_PARAMETERS),
    spikedExplosions: createExplosionPool(SPIKED_EXPLOSION_COUNT, SPIKED_EXPLOSION_PARAMETERS),
    debris: createDebrisPool(),
  })

export const getMotion = (world: ProjectileWorld, effectId: number): EffectMotion | null =>
  world.motions[effectId] ?? null

export const getWorldWithMotion = (
  world: ProjectileWorld,
  effectId: number,
  motion: EffectMotion | null
): ProjectileWorld =>
  Object.freeze({
    ...world,
    motions: Object.freeze(
      world.motions.map((current, index) => (index === effectId ? motion : current))
    ),
  })

export const getWorldWithRocketWobbleAngle = (
  world: ProjectileWorld,
  effectId: number,
  angle: number
): ProjectileWorld =>
  Object.freeze({
    ...world,
    rocketWobbleAngles: Object.freeze(
      world.rocketWobbleAngles.map((current, index) => (index === effectId ? angle : current))
    ),
  })

export const getWorldWithHookFramePosition = (
  world: ProjectileWorld,
  position: Vector3
): ProjectileWorld =>
  Object.freeze({
    ...world,
    hookFrame: Object.freeze({ rotation: world.hookFrame.rotation, position }),
  })

export const getWorldWithHookFrameRotation = (
  world: ProjectileWorld,
  rotation: Matrix3
): ProjectileWorld =>
  Object.freeze({
    ...world,
    hookFrame: Object.freeze({ rotation, position: world.hookFrame.position }),
  })

export const getWorldWithBarrelSpin = (
  world: ProjectileWorld,
  effectId: number,
  spin: BarrelSpin
): ProjectileWorld =>
  Object.freeze({
    ...world,
    barrelSpins: Object.freeze(
      world.barrelSpins.map((current, index) => (index === effectId ? spin : current))
    ),
  })

// 0x00452f60 (the barrel's start) zeroes the spin; nothing else does, so a barrel that reuses a slot restarts from 0.
export const getWorldWithStartedBarrelsReset = (
  world: ProjectileWorld,
  effects: readonly PowerUpEffect[]
): ProjectileWorld => {
  const isStarted = (effect: PowerUpEffect | undefined): boolean =>
    effect !== undefined &&
    effect.kind === PowerUpEffectKind.BARREL &&
    effect.state === EffectState.STARTING &&
    effect.timerMilliseconds === 0
  return world.barrelSpins.some((spin, index) => isStarted(effects[index]) && spin !== NO_BARREL_SPIN)
    ? Object.freeze({
        ...world,
        barrelSpins: Object.freeze(
          world.barrelSpins.map((spin, index) => (isStarted(effects[index]) ? NO_BARREL_SPIN : spin))
        ),
      })
    : world
}

export const getWorldWithEvents = (
  world: ProjectileWorld,
  events: readonly ProjectileEvent[]
): ProjectileWorld =>
  events.length === 0
    ? world
    : Object.freeze({ ...world, events: Object.freeze([...world.events, ...events]) })

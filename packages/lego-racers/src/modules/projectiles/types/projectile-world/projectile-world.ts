import type { PowerUpStep } from '../../../power-ups/index.ts'
import type { EffectMotion, ProjectileWorld } from './projectile-world.types.ts'

export const createProjectileWorld = (step: PowerUpStep): ProjectileWorld =>
  Object.freeze({
    motions: Object.freeze(step.world.effects.effects.map(() => null)),
  })

export const getMotion = (world: ProjectileWorld, effectId: number): EffectMotion | null =>
  world.motions[effectId] ?? null

export const getWorldWithMotion = (
  world: ProjectileWorld,
  effectId: number,
  motion: EffectMotion | null
): ProjectileWorld =>
  Object.freeze({
    motions: Object.freeze(
      world.motions.map((current, index) => (index === effectId ? motion : current))
    ),
  })

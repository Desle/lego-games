import type { PowerUpStep } from '../../../power-ups/index.ts'
import type { ProjectileEvent } from '../../events/projectile.events.types.ts'
import type { EffectMotion, ProjectileWorld } from './projectile-world.types.ts'

export const createProjectileWorld = (step: PowerUpStep): ProjectileWorld =>
  Object.freeze({
    motions: Object.freeze(step.world.effects.effects.map(() => null)),
    events: Object.freeze([]),
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

export const getWorldWithEvents = (
  world: ProjectileWorld,
  events: readonly ProjectileEvent[]
): ProjectileWorld =>
  events.length === 0
    ? world
    : Object.freeze({ ...world, events: Object.freeze([...world.events, ...events]) })

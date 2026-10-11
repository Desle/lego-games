import { EffectState } from '../../../power-ups/index.ts'
import type { PowerUpEffect } from '../../../power-ups/index.ts'
import { BallisticFlightState, ExplosionState } from '../../../projectiles/index.ts'
import type { EffectMotion, ExplosionPool } from '../../../projectiles/index.ts'
import type { RaceState } from '../../../race/index.ts'
import type { EffectView, EffectViews, ExplosionView } from '../../types/race-presentation.types.ts'

// The states in which an effect has a body to draw: after the launch and before its pool takes it back.
const DRAWN_STATES: readonly string[] = [
  EffectState.STARTING,
  EffectState.ACTIVE,
  EffectState.ENDING,
  EffectState.FINAL_STAGE,
]

const getMotionView = (effect: PowerUpEffect, motion: EffectMotion | null): EffectView | null => {
  if (motion === null) return null
  switch (motion.kind) {
    case 'ballistic':
      return motion.flight.state === BallisticFlightState.IDLE
        ? null
        : { kind: effect.kind, position: motion.flight.framePosition, heading: null }
    case 'rocket':
      return {
        kind: effect.kind,
        position: motion.homing?.flight.framePosition ?? motion.framePosition,
        heading: motion.homing?.heading ?? null,
      }
    case 'magnet':
      return { kind: effect.kind, position: motion.position, heading: null }
    case 'grapple':
      return { kind: effect.kind, position: motion.hook.flight.framePosition, heading: null }
    case 'wand':
      return null
  }
}

const getExplosionViews = (pool: ExplosionPool, isSpiked: boolean): readonly ExplosionView[] =>
  pool.activeIndices.flatMap((index) => {
    const explosion = pool.explosions[index]
    if (explosion === undefined || explosion.state === ExplosionState.IDLE) return []
    return [
      {
        isSpiked,
        position: explosion.position,
        scale: explosion.scale,
        isFading: explosion.state === ExplosionState.FADING,
      },
    ]
  })

// What the race draws of its projectiles and explosions this frame, from the power-up system and the projectile world:
// the launched effects with the position of their body (the cannon ball, the barrel, the rockets with the way they
// fly, the magnet, the grapple hook) and the explosions that grow or fade with their frame scale.
export const getEffectViews = (raceState: RaceState): EffectViews => {
  const { effects, activeEffectIds } = raceState.powerUpStep.world.effects
  const views = activeEffectIds.flatMap((effectId) => {
    const effect = effects[effectId]
    if (effect === undefined || !DRAWN_STATES.includes(effect.state)) return []
    const view = getMotionView(effect, raceState.projectileWorld.motions[effectId] ?? null)
    return view === null ? [] : [view]
  })
  return Object.freeze({
    effects: Object.freeze(views),
    explosions: Object.freeze([
      ...getExplosionViews(raceState.projectileWorld.explosions, false),
      ...getExplosionViews(raceState.projectileWorld.spikedExplosions, true),
    ]),
  })
}

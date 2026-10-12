import { BrickState, EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect } from '../../../power-ups/index.ts'
import { BallisticFlightState, ExplosionState } from '../../../projectiles/index.ts'
import type { EffectMotion, ExplosionPool } from '../../../projectiles/index.ts'
import type { RaceState } from '../../../race/index.ts'
import type {
  AttachmentView,
  BrickView,
  DrawnBrick,
  EffectView,
  EffectViews,
  ExplosionView,
} from '../../types/race-presentation.types.ts'

// The states in which an effect has a body to draw: after the launch and before its pool takes it back.
const DRAWN_STATES: readonly string[] = [
  EffectState.STARTING,
  EffectState.ACTIVE,
  EffectState.ENDING,
  EffectState.FINAL_STAGE,
]

// The states in which a brick is on the track: waiting, growing in and shrinking after a collect.
const SHOWN_BRICK_STATES: readonly string[] = [
  BrickState.AVAILABLE,
  BrickState.APPEARING,
  BrickState.COLLECTED,
]

const getBrickViews = (
  bricks: readonly DrawnBrick[],
  isEnhancement: boolean
): readonly BrickView[] =>
  bricks.flatMap((brick) =>
    SHOWN_BRICK_STATES.includes(brick.state)
      ? [
          {
            isEnhancement,
            kind: isEnhancement ? null : (brick.kind ?? null),
            position: brick.position,
            scale: brick.scale,
          },
        ]
      : []
  )

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
    case 'hazard':
      return null
  }
}

// 0x0045bd30: a shield of level 0..3 lasts this many milliseconds; 0x0045c2a0 gives it 1000 more while it ends.
const SHIELD_MILLISECONDS: readonly number[] = [4000, 6000, 8000, 10000]
const ENDING_MILLISECONDS = 1000

const getAttachmentView = (effect: PowerUpEffect): AttachmentView | null => {
  if (effect.kind !== PowerUpEffectKind.SHIELD || effect.ownerRacer === null) return null
  const isEnding = effect.state === EffectState.ENDING
  const total = SHIELD_MILLISECONDS[effect.level] ?? 0
  return {
    kind: effect.kind,
    level: effect.level,
    racerIndex: effect.ownerRacer,
    isEnding,
    elapsedMilliseconds: isEnding
      ? total + ENDING_MILLISECONDS - effect.timerMilliseconds
      : total - effect.timerMilliseconds,
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
  const { world } = raceState.powerUpStep
  const attachments = activeEffectIds.flatMap((effectId) => {
    const effect = effects[effectId]
    const view =
      effect === undefined || !DRAWN_STATES.includes(effect.state)
        ? null
        : getAttachmentView(effect)
    return view === null ? [] : [view]
  })
  return Object.freeze({
    attachments: Object.freeze(attachments),
    bricks: Object.freeze([
      ...getBrickViews(world.bricks, false),
      ...getBrickViews(world.enhancementBricks, true),
    ]),
    spinAngle: world.brickSpinAngle,
    effects: Object.freeze(views),
    explosions: Object.freeze([
      ...getExplosionViews(raceState.projectileWorld.explosions, false),
      ...getExplosionViews(raceState.projectileWorld.spikedExplosions, true),
    ]),
  })
}

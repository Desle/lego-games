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
  SpriteView,
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
  const base = {
    kind: effect.kind,
    rotation: null,
    rocketIndex: 0,
    isLaunching: false,
    launchMilliseconds: 0,
  }
  switch (motion.kind) {
    case 'ballistic':
      return motion.flight.state === BallisticFlightState.IDLE
        ? null
        : { ...base, position: motion.flight.framePosition, heading: null }
    case 'rocket':
      return {
        ...base,
        position: motion.homing?.flight.framePosition ?? motion.framePosition,
        heading: motion.homing?.heading ?? null,
        rotation: motion.frameRotation,
        rocketIndex: motion.rocketIndex,
        isLaunching: motion.homing === null,
        launchMilliseconds: motion.launchElapsedMilliseconds,
      }
    case 'magnet':
      return { ...base, position: motion.position, heading: null }
    case 'grapple':
      return { ...base, position: motion.hook.flight.framePosition, heading: null }
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

// 0x00451a50 gives the cannon ball the material "cannon" and a sprite of 5 by 5 (0x004b13a0); 0x00451f30 draws it while
// the ball flies (state 3).
const CANNON_BALL_MATERIAL = 'cannon'
const CANNON_BALL_SIZE = 5

const getSpriteViews = (
  effect: PowerUpEffect,
  motion: EffectMotion | null
): readonly SpriteView[] =>
  effect.kind === PowerUpEffectKind.CANNON &&
  effect.state === EffectState.ACTIVE &&
  motion?.kind === 'ballistic' &&
  motion.flight.state !== BallisticFlightState.IDLE
    ? [
        {
          materialName: CANNON_BALL_MATERIAL,
          position: motion.flight.framePosition,
          width: CANNON_BALL_SIZE,
          height: CANNON_BALL_SIZE,
        },
      ]
    : []

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
  const sprites = activeEffectIds.flatMap((effectId) => {
    const effect = effects[effectId]
    return effect === undefined
      ? []
      : getSpriteViews(effect, raceState.projectileWorld.motions[effectId] ?? null)
  })
  return Object.freeze({
    sprites: Object.freeze(sprites),
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

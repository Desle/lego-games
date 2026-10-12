import {
  EXPLOSION_SCAR_DECAL_LIMITS,
  getExplosionScarPlacement,
  getOilSlickPlacement,
  OIL_SLICK_DECAL_LIMITS,
} from '../../../decal/index.ts'
import { BrickState, EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect } from '../../../power-ups/index.ts'
import { BallisticFlightState, ExplosionState } from '../../../projectiles/index.ts'
import type { EffectMotion, ExplosionPool } from '../../../projectiles/index.ts'
import type { RaceState } from '../../../race/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type {
  BrickView,
  DecalView,
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

const { add, subtract, multiply, storeFloat } = createFloatArithmetic(RACE_FPU_PRECISION)

const OIL_SLICK_IMAGE_NAME = 'oilslck'
const EXPLOSION_SCAR_IMAGE_NAME = 'exscar'
// 0x004b0140: the scar starts at this side; 0x004b015c: and is drawn with this alpha while the burst grows.
const SMALLEST_SCAR_SIZE = Math.fround(0.1)
const GROWING_SCAR_ALPHA = 180

// 0x004573a0: an oil slick that has landed lies on the ground point it was placed at until it ends.
const getOilSlickDecalViews = (raceState: RaceState): readonly DecalView[] => {
  const { effects, activeEffectIds } = raceState.powerUpStep.world.effects
  return activeEffectIds.flatMap((effectId): readonly DecalView[] => {
    const effect = effects[effectId]
    const motion = raceState.projectileWorld.motions[effectId]
    if (
      effect === undefined ||
      effect.kind !== PowerUpEffectKind.OIL_SLICK ||
      effect.state !== EffectState.ACTIVE ||
      motion?.kind !== 'hazard'
    ) {
      return []
    }
    return [
      {
        imageName: OIL_SLICK_IMAGE_NAME,
        placement: getOilSlickPlacement(motion.position),
        limits: OIL_SLICK_DECAL_LIMITS,
        alpha: null,
      },
    ]
  })
}

// 0x00421850: a ground burst's scar grows with the burst (side (width - 0.1) x progress + 0.1, drawn at 180), then keeps
// its full width and fades.
const getScarDecalViews = (pool: ExplosionPool): readonly DecalView[] =>
  pool.activeIndices.flatMap((index): readonly DecalView[] => {
    const explosion = pool.explosions[index]
    if (explosion === undefined || !explosion.isGroundHit) return []
    const { scarWidth } = explosion.parameters
    if (explosion.state === ExplosionState.GROWING) {
      const size = storeFloat(
        add(
          multiply(subtract(scarWidth, SMALLEST_SCAR_SIZE), explosion.progress),
          SMALLEST_SCAR_SIZE
        )
      )
      return [
        {
          imageName: EXPLOSION_SCAR_IMAGE_NAME,
          placement: getExplosionScarPlacement(explosion.position, size),
          limits: EXPLOSION_SCAR_DECAL_LIMITS,
          alpha: GROWING_SCAR_ALPHA,
        },
      ]
    }
    if (explosion.state !== ExplosionState.FADING) return []
    return [
      {
        imageName: EXPLOSION_SCAR_IMAGE_NAME,
        placement: getExplosionScarPlacement(explosion.position, scarWidth),
        limits: EXPLOSION_SCAR_DECAL_LIMITS,
        alpha: Math.trunc(explosion.scarAlpha),
      },
    ]
  })

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
  return Object.freeze({
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
    decals: Object.freeze([
      ...getOilSlickDecalViews(raceState),
      ...getScarDecalViews(raceState.projectileWorld.explosions),
      ...getScarDecalViews(raceState.projectileWorld.spikedExplosions),
    ]),
  })
}

import {
  CRANE_SHADOW_DECAL_LIMITS,
  EXPLOSION_SCAR_DECAL_LIMITS,
  getCraneShadowPlacement,
  getExplosionScarPlacement,
  getOilSlickPlacement,
  OIL_SLICK_DECAL_LIMITS,
} from '../../../decal/index.ts'

import { getCraneShadows } from '../../../hazard/index.ts'
import { BrickState, EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect } from '../../../power-ups/index.ts'
import { BallisticFlightState, ExplosionState } from '../../../projectiles/index.ts'
import type { EffectMotion, ExplosionPool } from '../../../projectiles/index.ts'
import { getWarpFadeScale } from '../../../racer/index.ts'
import type { RaceState } from '../../../race/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type {
  AttachmentState,
  AttachmentView,
  BrickView,
  DecalView,
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

const { add, subtract, multiply, storeFloat } = createFloatArithmetic(RACE_FPU_PRECISION)

const OIL_SLICK_IMAGE_NAME = 'oilslck'
const EXPLOSION_SCAR_IMAGE_NAME = 'exscar'
const CRANE_SHADOW_IMAGE_NAME = 'crneshd'
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
        maximumSquaredDistance: null,
      },
    ]
  })
}

// 0x00490330: a crane that is not idle lays its shadow under the pose of its fourth bone, within the instance's draw distance.
const getCraneShadowDecalViews = (raceState: RaceState): readonly DecalView[] =>
  getCraneShadows(raceState.trackLogic.hazards, raceState.trackLogic.worlds).map((shadow) => ({
    imageName: CRANE_SHADOW_IMAGE_NAME,
    placement: getCraneShadowPlacement(shadow.bone, shadow.upHint),
    limits: CRANE_SHADOW_DECAL_LIMITS,
    alpha: null,
    maximumSquaredDistance: shadow.maximumSquaredDistance,
  }))

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
          maximumSquaredDistance: null,
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
        maximumSquaredDistance: null,
      },
    ]
  })

// 0x0045bd30: a shield of level 0..3 lasts this many milliseconds; 0x0045c2a0 gives it 1000 more while it ends.
const SHIELD_MILLISECONDS: readonly number[] = [4000, 6000, 8000, 10000]
const SHIELD_ENDING_MILLISECONDS = 1000
// 0x0045c8f0 starts a turbo for 400 ms; 0x0045d200 gives it 1000, 1500 or 5000 and then 700 to end.
const TURBO_STARTING_MILLISECONDS = 400
const TURBO_MILLISECONDS: readonly number[] = [1000, 1500, 5000]
const TURBO_ENDING_MILLISECONDS = 700
// 0x0045d560: the warp's first phase lasts 500 ms.
const WARP_STARTING_MILLISECONDS = 500

const getAttachmentState = (state: PowerUpEffect['state']): AttachmentState | null => {
  switch (state) {
    case EffectState.STARTING:
      return 'starting'
    case EffectState.ACTIVE:
      return 'active'
    case EffectState.ENDING:
      return 'ending'
    default:
      return null
  }
}

const getAttachmentElapsed = (effect: PowerUpEffect, state: AttachmentState): number => {
  if (effect.kind === PowerUpEffectKind.SHIELD) {
    const total = SHIELD_MILLISECONDS[effect.level] ?? 0
    return state === 'ending'
      ? total + SHIELD_ENDING_MILLISECONDS - effect.timerMilliseconds
      : total - effect.timerMilliseconds
  }
  if (state === 'starting') return TURBO_STARTING_MILLISECONDS - effect.timerMilliseconds
  if (state === 'ending') return TURBO_ENDING_MILLISECONDS - effect.timerMilliseconds
  return (TURBO_MILLISECONDS[effect.level] ?? 0) - effect.timerMilliseconds
}

const getAttachmentView = (raceState: RaceState, effect: PowerUpEffect): AttachmentView | null => {
  const isAttached =
    effect.kind === PowerUpEffectKind.SHIELD || effect.kind === PowerUpEffectKind.TURBO
  const state = getAttachmentState(effect.state)
  if (effect.ownerRacer === null || state === null) return null
  // 0x0045dbe0: the warp's portal is drawn in its first phase (state 2) at the scale the fade table gives.
  if (effect.kind === PowerUpEffectKind.WARP) {
    if (state !== 'starting') return null
    return {
      kind: effect.kind,
      level: effect.level,
      racerIndex: effect.ownerRacer,
      state,
      timerMilliseconds: effect.timerMilliseconds,
      elapsedMilliseconds: WARP_STARTING_MILLISECONDS - effect.timerMilliseconds,
      scale: getWarpFadeScale(
        raceState.context.arithmetic,
        raceState.context.tables,
        effect.timerMilliseconds
      ),
    }
  }
  if (!isAttached) return null
  return {
    scale: 1,
    kind: effect.kind,
    level: effect.level,
    racerIndex: effect.ownerRacer,
    state,
    timerMilliseconds: effect.timerMilliseconds,
    elapsedMilliseconds: getAttachmentElapsed(effect, state),
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
        : getAttachmentView(raceState, effect)
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
    decals: Object.freeze([
      ...getOilSlickDecalViews(raceState),
      ...getCraneShadowDecalViews(raceState),
      ...getScarDecalViews(raceState.projectileWorld.explosions),
      ...getScarDecalViews(raceState.projectileWorld.spikedExplosions),
    ]),
  })
}

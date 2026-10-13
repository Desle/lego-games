import {
  BrickState,
  getBrickKindCode,
  getEffectStateNumber,
  POWER_UP_EFFECT_POOL_ORDER,
} from '../../../power-ups/index.ts'
import type {
  EnhancementBrick,
  PowerUpBrick,
  PowerUpStep,
  RacerPowerUps,
} from '../../../power-ups/index.ts'
import { getVectorWords, getFloatWords } from '../trace-words/trace-words.ts'
import { getProjectileRegistrySphere } from '../../../race/index.ts'
import { PowerUpEffectKind } from '../../../power-ups/index.ts'
import { ExplosionState } from '../../../projectiles/index.ts'
import type { ExplosionPool } from '../../../projectiles/index.ts'
import type { RaceState } from '../../../race/index.ts'
import type { TraceFields } from '../../types/golden-trace.types.ts'

const END_OF_LIST = 0xffffffff
const BRICK_STATE_NUMBERS = Object.freeze({
  [BrickState.AVAILABLE]: 0,
  [BrickState.HIDDEN]: 1,
  [BrickState.APPEARING]: 2,
  [BrickState.COLLECTED]: 3,
  [BrickState.UNUSED]: 4,
})
const EXPLOSION_STATE_NUMBERS = Object.freeze({
  [ExplosionState.IDLE]: 1,
  [ExplosionState.GROWING]: 2,
  [ExplosionState.FADING]: 3,
})
const SOUND_ENABLED_FLAG = 0x1
const TOUCHED_THIS_FRAME_FLAG = 0x2
const TOUCHED_LAST_FRAME_FLAG = 0x4
const DROPPED_FLAG = 0x1
const RETURNING_HOME_FLAG = 0x2

const getBrickFlags = (brick: PowerUpBrick | EnhancementBrick): number =>
  (brick.isSoundEnabled ? SOUND_ENABLED_FLAG : 0) |
  (brick.isTouchedThisFrame ? TOUCHED_THIS_FRAME_FLAG : 0) |
  (brick.isTouchedLastFrame ? TOUCHED_LAST_FRAME_FLAG : 0)

// 0x00453910 and 0x00457640: state +0x3c, state after the collect +0x40, timer +0x4c, flags +0x50, kinds +0x5c, +0x60, +0x64.
const getBrickWords = (brick: PowerUpBrick): readonly number[] => [
  BRICK_STATE_NUMBERS[brick.state],
  BRICK_STATE_NUMBERS[brick.stateAfterCollect],
  brick.timerMilliseconds >>> 0,
  getBrickFlags(brick),
  getBrickKindCode(brick.placedKind),
  getBrickKindCode(brick.kind),
  getBrickKindCode(brick.nextKind),
]

// 0x004535a0: state +0x3c, timer +0x4c, flags +0x50, dropped time +0x60, flags +0x64.
const getEnhancementBrickWords = (brick: EnhancementBrick): readonly number[] => [
  BRICK_STATE_NUMBERS[brick.state],
  brick.timerMilliseconds >>> 0,
  getBrickFlags(brick),
  brick.droppedMilliseconds >>> 0,
  (brick.isDropped ? DROPPED_FLAG : 0) | (brick.isReturningHome ? RETURNING_HOME_FLAG : 0),
]

// The active effects, head first: pool, state, timer, level.
const getEffectWords = (step: PowerUpStep): readonly number[] =>
  step.world.effects.activeEffectIds.flatMap((effectId) => {
    const effect = step.world.effects.effects[effectId]
    if (effect === undefined) return []
    return [
      POWER_UP_EFFECT_POOL_ORDER.indexOf(effect.kind),
      getEffectStateNumber(effect.state),
      effect.timerMilliseconds >>> 0,
      effect.level,
    ]
  })

const getExplosionPoolWords = (pool: ExplosionPool): readonly number[] => [
  ...pool.activeIndices.flatMap((index) => {
    const explosion = pool.explosions[index]
    return explosion === undefined
      ? []
      : [EXPLOSION_STATE_NUMBERS[explosion.state], explosion.remainingMilliseconds >>> 0]
  }),
  END_OF_LIST,
]

const REGISTRY_TAGS: Readonly<Partial<Record<string, number>>> = Object.freeze({
  [PowerUpEffectKind.OIL_SLICK]: 1,
  [PowerUpEffectKind.MAGNET]: 2,
  [PowerUpEffectKind.CURSE]: 3,
  [PowerUpEffectKind.CANNON]: 4,
  [PowerUpEffectKind.BARREL]: 4,
  [PowerUpEffectKind.GRAPPLE]: 5,
  [PowerUpEffectKind.ROCKET]: 6,
})
const EXPLOSION_TAG = 7

// The active entries of the moving power-up objects in list order: tag, shape centre and radius.
const getRegistryWords = (raceState: RaceState): readonly number[] =>
  raceState.racerSet.registryEntries.flatMap((entry) => {
    const object = raceState.registryObjects[entry.id]
    if (!entry.isActive || object === undefined) return []
    const source = { ...raceState, arithmetic: raceState.context.arithmetic }
    if (object.type === 'explosion') {
      const sphere = getProjectileRegistrySphere(source, object)
      return [EXPLOSION_TAG, ...getVectorWords(sphere.centre), ...getFloatWords([sphere.radius])]
    }
    if (object.type !== 'effect_flight' && object.type !== 'effect_hazard') return []
    const effect = raceState.powerUpStep.world.effects.effects[object.effectId]
    const sphere = getProjectileRegistrySphere(source, object)
    return [
      effect === undefined ? 0 : (REGISTRY_TAGS[effect.kind] ?? 0),
      ...getVectorWords(sphere.centre),
      ...getFloatWords([sphere.radius]),
    ]
  })

// The barrels' spin angles (effect +0x178) in pool order.
const getBarrelSpinWords = (raceState: RaceState): readonly number[] =>
  raceState.powerUpStep.world.effects.effects.flatMap((effect, index) =>
    effect.kind === PowerUpEffectKind.BARREL
      ? getFloatWords([raceState.projectileWorld.barrelSpins[index]?.angle ?? 0])
      : []
  )

const getHeldLevelWords = (racers: readonly RacerPowerUps[]): TraceFields =>
  Object.fromEntries(
    racers.map((racer, index) => [`racer${String(index)}.powerUps.level`, [racer.enhancementLevel]])
  )

// The fields of power_up_trace.py.
export const getPowerUpTraceFields = (raceState: RaceState): TraceFields => {
  const { world } = raceState.powerUpStep
  return {
    'powerUps.bricks': world.bricks.flatMap(getBrickWords),
    'powerUps.enhancementBricks': world.enhancementBricks.flatMap(getEnhancementBrickWords),
    'powerUps.effects': getEffectWords(raceState.powerUpStep),
    'powerUps.registry': getRegistryWords(raceState),
    'powerUps.barrelSpins': getBarrelSpinWords(raceState),
    'powerUps.explosions': [
      ...getExplosionPoolWords(raceState.projectileWorld.explosions),
      ...getExplosionPoolWords(raceState.projectileWorld.spikedExplosions),
    ],
    ...getHeldLevelWords(world.racers),
  }
}

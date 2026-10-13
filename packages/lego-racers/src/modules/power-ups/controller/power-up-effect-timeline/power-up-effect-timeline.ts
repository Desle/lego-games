import {
  BARREL_HUM_ADDRESS,
  BARREL_HUM_SOUND_ID,
  CURSE_HUM_ADDRESS,
  CURSE_HUM_SOUND_ID,
  GRAPPLE_LATCHED_RELEASE_SOUND,
  GRAPPLE_LAUNCH_SOUND,
  GRAPPLE_RELEASE_SOUND,
  GRAPPLE_SNAP_SOUND,
  MAGNET_LAST_SECOND_SOUND,
  OIL_LANDING_SOUND,
  SHIELD_END_SOUND,
  WAND_END_SOUND,
  WAND_SPARK_SOUND,
  WARP_END_SOUND,
  WARP_SOUND,
  WARP_START_SOUND,
} from '../power-up-sounds/power-up-sounds.ts'
import type { PowerUpEvent } from '../../events/power-up.events.types.ts'
import { RaceModeFlag } from '../../types/brick-kind/brick-kind.ts'
import {
  EffectState,
  PowerUpEffectKind,
} from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type { EffectState as EffectStateValue, PowerUpEffect } from '../../types/power-ups.types.ts'
import { releaseEffectEmitter, startEffectEmitter } from '../effect-emitters/effect-emitters.ts'
import {
  getEffect,
  getStepDraws,
  getStepWithEffect,
  getStepWithEvents,
  getStepWithVoice,
} from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import type { OwnerEvent, OwnerEventType, WandBeamStep } from './power-up-effect-timeline.types.ts'

const keepStep: WandBeamStep = (step) => step

// 0x0045d200: turbo levels 0..2.
const TURBO_MILLISECONDS: readonly number[] = Object.freeze([1000, 1500, 5000])
const TURBO_LEVEL_TWO = 2
// 0x00454d70 and 0x00454b20: one jitter draw per 50 ms.
const WAND_JITTER_PERIOD_MILLISECONDS = 50
// 0x00454d70: a struck racer is let go after 1000 ms.
const WAND_HOLD_MILLISECONDS = 1000
// 0x00453240: explosions scatter by (table % 13) - 6 on x and y.
const BARREL_SCATTER_MODULUS = 13
const BARREL_SCATTER_OFFSET = 6

const getWithState = (
  step: PowerUpStep,
  effect: PowerUpEffect,
  state: EffectStateValue,
  timerMilliseconds: number
): PowerUpStep => getStepWithEffect(step, { ...effect, state, timerMilliseconds })

// 0x00453240 states 4 and 5: two draws for the offset, then an explosion through 0x0045b4f0.
const getStepWithScatteredExplosion = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep => {
  const draws = getStepDraws(step, 2)
  const [first = 0, second = 0] = draws.values
  return getStepWithEvents(draws.step, [
    {
      type: 'power_ups.explosion',
      effect: effect.id,
      isSpiked: true,
      isGroundHit: true,
      offset: Object.freeze({
        x: (first % BARREL_SCATTER_MODULUS) - BARREL_SCATTER_OFFSET,
        y: (second % BARREL_SCATTER_MODULUS) - BARREL_SCATTER_OFFSET,
        z: 0,
      }),
    },
  ])
}

const advanceBarrel = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect
): PowerUpStep => {
  if (effect.state === EffectState.STARTING)
    // 0x00453240 case 2: the thrown barrel throws sparks and loops sound 0x11.
    return getStepWithEvents(
      startEffectEmitter(
        getWithState(step, effect, EffectState.ACTIVE, 5000),
        context.arithmetic,
        effect.id,
        'dynsprk'
      ),
      [
        {
          type: 'power_ups.looped_sound_started',
          key: `barrel:${String(effect.id)}`,
          soundId: BARREL_HUM_SOUND_ID,
          address: BARREL_HUM_ADDRESS,
          ownerRacer: effect.ownerRacer,
        },
      ]
    )
  if (effect.state === EffectState.ACTIVE) {
    return getStepWithEvents(getWithState(step, effect, EffectState.FINISHED, 0), [
      {
        type: 'power_ups.explosion',
        effect: effect.id,
        isSpiked: true,
        isGroundHit: true,
        offset: Object.freeze({ x: 0, y: 0, z: 0 }),
      },
    ])
  }
  if (effect.state === EffectState.ENDING) {
    return getWithState(
      getStepWithScatteredExplosion(step, effect),
      effect,
      EffectState.FINAL_STAGE,
      500
    )
  }
  if (effect.state !== EffectState.FINAL_STAGE) return step
  return getWithState(getStepWithScatteredExplosion(step, effect), effect, EffectState.FINISHED, 0)
}

const advanceTurbo = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect
): PowerUpStep => {
  if (effect.state === EffectState.STARTING) {
    const started = getWithState(
      step,
      effect,
      EffectState.ACTIVE,
      TURBO_MILLISECONDS[effect.level] ?? effect.timerMilliseconds
    )
    return effect.ownerRacer === null ? started : getStepWithVoice(started, effect.ownerRacer, true)
  }
  if (effect.state === EffectState.ACTIVE) {
    const isEndless =
      effect.level === TURBO_LEVEL_TWO && (context.raceModeFlags & RaceModeFlag.ENDLESS_TURBO) !== 0
    return isEndless
      ? getWithState(step, effect, EffectState.ACTIVE, 5000)
      : getWithState(step, effect, EffectState.ENDING, 700)
  }
  // 0x0045d200 state 4: the turbo's end sound, 0x4b for level 2 and 0x28 for the others.
  return effect.state === EffectState.ENDING
    ? getStepWithEvents(
        getWithState(step, effect, EffectState.FINISHED, effect.timerMilliseconds),
        [
          effect.level === TURBO_LEVEL_TWO
            ? { type: 'power_ups.sound_played', soundId: 0x4b, address: '0x0045d267' }
            : { type: 'power_ups.sound_played', soundId: 0x28, address: '0x0045d2a3' },
        ]
      )
    : step
}

// 0x004573a0: the owner's car body flips (0x00429cf0, rate 0.0015, 150 ms) as the slick drops.
const OIL_LANDING_FLIP_RATE = Math.fround(0.0015)
const OIL_LANDING_FLIP_MILLISECONDS = 150

// Sound 0x2e plays (0x00457431) whoever dropped the slick, and sound 0x30 loops on it (0x00457440).
const OIL_LOOP_SOUND = 0x30
const getOilLoopKey = (effect: PowerUpEffect) => `oil:${String(effect.id)}`

const getOilLandingEvents = (effect: PowerUpEffect): readonly PowerUpEvent[] => [
  OIL_LANDING_SOUND,
  {
    type: 'power_ups.looped_sound_started',
    key: getOilLoopKey(effect),
    soundId: OIL_LOOP_SOUND,
    address: '0x00457440',
    ownerRacer: effect.ownerRacer,
  },
  ...(effect.ownerRacer === null
    ? []
    : [
        {
          type: 'power_ups.racer_flipped' as const,
          racer: effect.ownerRacer,
          rate: OIL_LANDING_FLIP_RATE,
          milliseconds: OIL_LANDING_FLIP_MILLISECONDS,
        },
      ]),
]

const getOwnerEvent = (effect: PowerUpEffect, type: OwnerEventType): readonly OwnerEvent[] =>
  effect.ownerRacer === null ? [] : [{ type, racer: effect.ownerRacer }]

const advanceShieldOrWarp = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect
): PowerUpStep => {
  if (effect.kind === PowerUpEffectKind.SHIELD) {
    if (effect.state === EffectState.ACTIVE)
      return getWithState(step, effect, EffectState.ENDING, 1000)
    if (effect.state !== EffectState.ENDING) return step
    // 0x0045c2a0 state 4: sound 0x3b, then 0x00439790 lowers the shield.
    return getStepWithEvents(
      getWithState(step, effect, EffectState.FINISHED, effect.timerMilliseconds),
      [SHIELD_END_SOUND, ...getOwnerEvent(effect, 'power_ups.racer_shield_lowered')]
    )
  }
  // 0x0045dc90: a human racer's warp (+0xe0 is set for a computer, 0x0045d560) starts with sound 0x27 and ends with
  // 0x29; every warp starts with sound 0x41 at the racer.
  const isOwnWarp =
    effect.ownerRacer === null || context.racers[effect.ownerRacer]?.isComputer !== true
  if (effect.state === EffectState.STARTING) {
    return getStepWithEvents(getWithState(step, effect, EffectState.ACTIVE, 1500), [
      ...getOwnerEvent(effect, 'power_ups.racer_warp_started'),
      ...(isOwnWarp ? [WARP_START_SOUND] : []),
      WARP_SOUND,
    ])
  }
  if (effect.state !== EffectState.ACTIVE) return step
  return getStepWithEvents(
    getWithState(step, effect, EffectState.FINISHED, effect.timerMilliseconds),
    [...getOwnerEvent(effect, 'power_ups.racer_warp_ended'), ...(isOwnWarp ? [WARP_END_SOUND] : [])]
  )
}

// Two-stage classes: STARTING → ACTIVE (first duration), ACTIVE → ENDING (second) → FINISHED.
const advanceThreeStages = (
  step: PowerUpStep,
  effect: PowerUpEffect,
  activeMilliseconds: number,
  endingMilliseconds: number
): PowerUpStep => {
  if (effect.state === EffectState.STARTING) {
    return getWithState(step, effect, EffectState.ACTIVE, activeMilliseconds)
  }
  if (effect.state === EffectState.ACTIVE) {
    return getWithState(step, effect, EffectState.ENDING, endingMilliseconds)
  }
  return getWithState(step, effect, EffectState.FINISHED, 0)
}

const advanceProjectile = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect
): PowerUpStep => {
  if (effect.kind === PowerUpEffectKind.GRAPPLE) {
    // 0x00454360: the hook leaves in a puff of smoke.
    if (effect.state === EffectState.STARTING)
      return getStepWithEvents(
        startEffectEmitter(
          getWithState(step, effect, EffectState.ACTIVE, 3000),
          context.arithmetic,
          effect.id,
          'cannsmk'
        ),
        // 0x00454360 state 2 ends with the launch sound.
        [GRAPPLE_LAUNCH_SOUND]
      )
    if (effect.state === EffectState.ACTIVE || effect.state === EffectState.ENDING) {
      return retractGrapple(step, effect)
    }
    return getWithState(step, effect, EffectState.FINISHED, 0)
  }
  if (effect.kind === PowerUpEffectKind.WAND) {
    const advanced = advanceThreeStages(step, effect, 7000, 500)
    // 0x00455060: the hit sparks are let go when the wand ends, and its state 4 ends with sound 0x42.
    return effect.state === EffectState.STARTING || effect.state === EffectState.ACTIVE
      ? advanced
      : getStepWithEvents(releaseEffectEmitter(advanced, effect.id, false), [
          WAND_END_SOUND,
          ...(effect.ownerRacer === null
            ? []
            : [
                {
                  type: 'power_ups.looped_sound_stopped' as const,
                  key: `wand:${String(effect.ownerRacer)}`,
                  address: '0x00455060',
                },
              ]),
        ])
  }
  // Cannon 0x00451f50 (3000 ms flight, with its smoke) and rocket 0x00456db0 (5500 ms).
  if (effect.state === EffectState.STARTING) {
    const started = getWithState(
      step,
      effect,
      EffectState.ACTIVE,
      effect.kind === PowerUpEffectKind.CANNON ? 3000 : 0x157c
    )
    // 0x00451f50 state 2 ends with the launch sound.
    return effect.kind === PowerUpEffectKind.CANNON
      ? getStepWithEvents(startEffectEmitter(started, context.arithmetic, effect.id, 'cannsmk'), [
          { type: 'power_ups.sound_played', soundId: 6, address: '0x00452367' },
        ])
      : started
  }
  return getWithState(step, effect, EffectState.FINISHED, 0)
}

// 0x00454690: the grapple pulls back for 500 ms. A latched racer (state 4, +0xd4) is let go with sound 0x14; a grapple
// that caught nobody snaps (0x16) and releases (0x49).
export const retractGrapple = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep =>
  getStepWithEvents(getWithState(step, effect, EffectState.FINAL_STAGE, 500), [
    ...(effect.state === EffectState.ENDING
      ? [
          {
            type: 'power_ups.grapple_released' as const,
            effect: effect.id,
            victim: effect.targetRacer,
            owner: effect.ownerRacer,
          },
          GRAPPLE_LATCHED_RELEASE_SOUND,
        ]
      : [GRAPPLE_SNAP_SOUND, GRAPPLE_RELEASE_SOUND]),
  ])

// Vtable slot 5, called when an effect's timer runs out (0x004513a0) or its projectile ends.
export const advancePowerUpEffect = (
  step: PowerUpStep,
  context: PowerUpContext,
  effectId: number
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  switch (effect.kind) {
    case PowerUpEffectKind.CANNON:
    case PowerUpEffectKind.GRAPPLE:
    case PowerUpEffectKind.WAND:
    case PowerUpEffectKind.ROCKET:
      return advanceProjectile(step, context, effect)
    case PowerUpEffectKind.OIL_SLICK:
      // 0x004573a0: the slick lands for 10 s and its bubble emitter starts.
      return effect.state === EffectState.STARTING
        ? startEffectEmitter(
            getStepWithEvents(
              getWithState(step, effect, EffectState.ACTIVE, 10000),
              getOilLandingEvents(effect)
            ),
            context.arithmetic,
            effect.id,
            'oilbub'
          )
        : getStepWithEvents(getWithState(step, effect, EffectState.FINISHED, 0), [
            {
              type: 'power_ups.looped_sound_stopped',
              key: getOilLoopKey(effect),
              address: '0x004573a0',
            },
          ])
    case PowerUpEffectKind.BARREL:
      return advanceBarrel(step, context, effect)
    case PowerUpEffectKind.MAGNET:
      // 0x00455f50: the magnet's last second begins with sound 0x4a and it ends the second after.
      return effect.state === EffectState.ENDING
        ? getStepWithEvents(
            getWithState(step, effect, EffectState.FINISHED, effect.timerMilliseconds),
            [
              {
                type: 'power_ups.looped_sound_stopped',
                key: `magnet:${String(effect.id)}`,
                address: '0x00455f50',
              },
            ]
          )
        : getStepWithEvents(getWithState(step, effect, EffectState.ENDING, 1000), [
            MAGNET_LAST_SECOND_SOUND,
          ])
    case PowerUpEffectKind.CURSE: {
      // 0x00452ae0: the curse figure loops sound 9 while it stands.
      const advanced = advanceThreeStages(step, effect, 15000, 1000)
      if (effect.state === EffectState.STARTING) {
        return getStepWithEvents(advanced, [
          {
            type: 'power_ups.looped_sound_started',
            key: `curse:${String(effect.id)}`,
            soundId: CURSE_HUM_SOUND_ID,
            address: CURSE_HUM_ADDRESS,
            ownerRacer: null,
          },
        ])
      }
      return effect.state === EffectState.ACTIVE || effect.state === EffectState.ENDING
        ? advanced
        : getStepWithEvents(advanced, [
            {
              type: 'power_ups.looped_sound_stopped',
              key: `curse:${String(effect.id)}`,
              address: '0x00452ae0',
            },
          ])
    }
    case PowerUpEffectKind.TURBO:
      return advanceTurbo(step, context, effect)
    default:
      // Shield 0x0045c2a0, warp 0x0045dc90.
      return advanceShieldOrWarp(step, context, effect)
  }
}

// 0x004513a0 (and the same test inlined in the cannon, grapple and wand updates).
const countDown = (
  step: PowerUpStep,
  context: PowerUpContext,
  effectId: number,
  stepMilliseconds: number
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  if (stepMilliseconds < effect.timerMilliseconds) {
    return getStepWithEffect(step, {
      ...effect,
      timerMilliseconds: effect.timerMilliseconds - stepMilliseconds,
    })
  }
  return advancePowerUpEffect(
    getStepWithEffect(step, { ...effect, timerMilliseconds: 0 }),
    context,
    effectId
  )
}

const getStepWithDraws = (step: PowerUpStep, count: number): PowerUpStep =>
  getStepDraws(step, count).step

// 0x00454b20: the draw goes in the next slot of the wand's ring of 20 jitter values.
const WAND_JITTER_SLOT_COUNT = 20

const getEffectWithJitterDraws = (
  effect: PowerUpEffect,
  values: readonly number[]
): PowerUpEffect => {
  const draws = [...effect.jitterDraws]
  let jitterIndex = effect.jitterIndex
  for (const value of values) {
    draws[jitterIndex] = value
    jitterIndex = jitterIndex + 1 >= WAND_JITTER_SLOT_COUNT ? 0 : jitterIndex + 1
  }
  return Object.freeze({ ...effect, jitterDraws: Object.freeze(draws), jitterIndex })
}

// 0x00454d70 after the countdown: jitter draws, the hold on a struck racer, and sparks (0x00454e50).
const updateWand = (
  step: PowerUpStep,
  effectId: number,
  stepMilliseconds: number,
  duringBeam: WandBeamStep
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  let jitterMilliseconds = (effect.jitterMilliseconds + stepMilliseconds) >>> 0
  let drawCount = 0
  while (jitterMilliseconds > WAND_JITTER_PERIOD_MILLISECONDS) {
    drawCount += 1
    jitterMilliseconds -= WAND_JITTER_PERIOD_MILLISECONDS
  }
  const jitterDraws = getStepDraws(step, drawCount)
  const jittered = jitterDraws.step
  const heldMilliseconds =
    effect.targetRacer === null
      ? effect.heldMilliseconds
      : effect.heldMilliseconds + stepMilliseconds
  const releasedRacer =
    effect.targetRacer !== null && heldMilliseconds > WAND_HOLD_MILLISECONDS
      ? effect.targetRacer
      : null
  const isReleased = releasedRacer !== null
  const held = getStepWithEvents(
    getStepWithEffect(jittered, {
      ...getEffectWithJitterDraws(effect, jitterDraws.values),
      jitterMilliseconds,
      heldMilliseconds: isReleased ? 0 : heldMilliseconds,
      targetRacer: isReleased ? null : effect.targetRacer,
    }),
    releasedRacer === null
      ? []
      : [{ type: 'power_ups.racer_released_by_lightning', racer: releasedRacer }]
  )
  // 0x00455100..0x00455350 (the beam and its hit test) run between the hold and the sparks.
  const beamed = duringBeam(held)
  const current = getEffect(beamed, effectId)
  if (current.state !== EffectState.ACTIVE) return beamed
  if (stepMilliseconds <= current.sparkMilliseconds) {
    return getStepWithEffect(beamed, {
      ...current,
      sparkMilliseconds: current.sparkMilliseconds - stepMilliseconds,
    })
  }
  const sparkDraws = getStepDraws(beamed, 2)
  // 0x00454e50: the spark plays sound 0x45 between its two draws.
  return getStepWithEvents(
    getStepWithEffect(sparkDraws.step, {
      ...current,
      sparkMilliseconds: ((sparkDraws.values[1] ?? 0) % 300) + 200,
    }),
    [WAND_SPARK_SOUND]
  )
}

const getStepWithFiguresStepped = (
  step: PowerUpStep,
  effectId: number,
  stepMilliseconds: number
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  return getStepWithEffect(step, {
    ...effect,
    figureAgeMilliseconds: effect.figureAgeMilliseconds + stepMilliseconds,
  })
}

// Vtable slot 2 for one active effect; the movement and collision parts are not ported (power-ups.md).
export const updatePowerUpEffect = (
  step: PowerUpStep,
  context: PowerUpContext,
  effectId: number,
  stepMilliseconds: number,
  duringWandBeam: WandBeamStep = keepStep
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  if (effect.state === EffectState.FINISHED || effect.kind === PowerUpEffectKind.ROCKET) return step
  const counted = getStepWithFiguresStepped(
    countDown(step, context, effectId, stepMilliseconds),
    effectId,
    stepMilliseconds
  )
  if (effect.kind === PowerUpEffectKind.WAND) {
    // 0x00454d70: when the countdown ends the rest of the step goes on to the jitter, the hold and the sparks.
    const restMilliseconds =
      stepMilliseconds < effect.timerMilliseconds
        ? stepMilliseconds
        : stepMilliseconds - effect.timerMilliseconds
    return updateWand(counted, effectId, restMilliseconds, duringWandBeam)
  }
  // 0x004572a0: two draws per frame while the bubble emitter exists.
  if (
    effect.kind === PowerUpEffectKind.OIL_SLICK &&
    getEffect(counted, effectId).emitterHandleIndex !== null
  ) {
    return getStepWithDraws(counted, 2)
  }
  return counted
}

// PowerUps_Update 0x0045a490: every active effect, head first.
export const updatePowerUpEffects = (
  step: PowerUpStep,
  context: PowerUpContext,
  stepMilliseconds: number
): PowerUpStep =>
  step.world.effects.activeEffectIds.reduce(
    (current, effectId) => updatePowerUpEffect(current, context, effectId, stepMilliseconds),
    step
  )

// 0x004548f0 → 0x00454b90: each wand in the pool fills its 20 jitter values when the race loads.
export const WAND_INITIAL_DRAWS = 20

export const getStepWithInitialWandDraws = (step: PowerUpStep): PowerUpStep =>
  step.world.effects.effects
    .filter((effect) => effect.kind === PowerUpEffectKind.WAND)
    .reduce((current, wand) => {
      const draws = getStepDraws(current, WAND_INITIAL_DRAWS)
      return getStepWithEffect(
        draws.step,
        getEffectWithJitterDraws(getEffect(draws.step, wand.id), draws.values)
      )
    }, step)

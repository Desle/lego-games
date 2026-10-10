import { RaceModeFlag } from '../../types/brick-kind/brick-kind.ts'
import {
  EffectState,
  PowerUpEffectKind,
} from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type { EffectState as EffectStateValue, PowerUpEffect } from '../../types/power-ups.types.ts'
import {
  getEffect,
  getStepDraws,
  getStepWithEffect,
  getStepWithEvents,
  getStepWithVoice,
} from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import type {
  OwnerEvent,
  OwnerEventType,
  WandBeamStep,
} from './power-up-effect-timeline.types.ts'

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

const advanceBarrel = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep => {
  if (effect.state === EffectState.STARTING)
    return getWithState(step, effect, EffectState.ACTIVE, 5000)
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
  return effect.state === EffectState.ENDING
    ? getWithState(step, effect, EffectState.FINISHED, effect.timerMilliseconds)
    : step
}

const getOwnerEvent = (effect: PowerUpEffect, type: OwnerEventType): readonly OwnerEvent[] =>
  effect.ownerRacer === null ? [] : [{ type, racer: effect.ownerRacer }]

const advanceShieldOrWarp = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep => {
  if (effect.kind === PowerUpEffectKind.SHIELD) {
    if (effect.state === EffectState.ACTIVE)
      return getWithState(step, effect, EffectState.ENDING, 1000)
    if (effect.state !== EffectState.ENDING) return step
    return getStepWithEvents(
      getWithState(step, effect, EffectState.FINISHED, effect.timerMilliseconds),
      getOwnerEvent(effect, 'power_ups.racer_shield_lowered')
    )
  }
  if (effect.state === EffectState.STARTING) {
    return getStepWithEvents(
      getWithState(step, effect, EffectState.ACTIVE, 1500),
      getOwnerEvent(effect, 'power_ups.racer_warp_started')
    )
  }
  if (effect.state !== EffectState.ACTIVE) return step
  return getStepWithEvents(
    getWithState(step, effect, EffectState.FINISHED, effect.timerMilliseconds),
    getOwnerEvent(effect, 'power_ups.racer_warp_ended')
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

const advanceProjectile = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep => {
  if (effect.kind === PowerUpEffectKind.GRAPPLE) {
    if (effect.state === EffectState.STARTING)
      return getWithState(step, effect, EffectState.ACTIVE, 3000)
    if (effect.state === EffectState.ACTIVE || effect.state === EffectState.ENDING) {
      return retractGrapple(step, effect)
    }
    return getWithState(step, effect, EffectState.FINISHED, 0)
  }
  if (effect.kind === PowerUpEffectKind.WAND) return advanceThreeStages(step, effect, 7000, 500)
  // Cannon 0x00451f50 (3000 ms flight) and rocket 0x00456db0 (5500 ms).
  if (effect.state === EffectState.STARTING) {
    return getWithState(
      step,
      effect,
      EffectState.ACTIVE,
      effect.kind === PowerUpEffectKind.CANNON ? 3000 : 0x157c
    )
  }
  return getWithState(step, effect, EffectState.FINISHED, 0)
}

// 0x00454690: the grapple pulls back for 500 ms; a latched racer (state 4) is let go.
export const retractGrapple = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep =>
  getStepWithEvents(
    getWithState(step, effect, EffectState.FINAL_STAGE, 500),
    effect.state === EffectState.ENDING
      ? [{ type: 'power_ups.grapple_released', effect: effect.id }]
      : []
  )

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
      return advanceProjectile(step, effect)
    case PowerUpEffectKind.OIL_SLICK:
      // 0x004573a0: the slick lands for 10 s and its bubble emitter starts.
      return effect.state === EffectState.STARTING
        ? getStepWithEffect(step, {
            ...effect,
            state: EffectState.ACTIVE,
            timerMilliseconds: 10000,
            isBubbleEmitterActive: true,
          })
        : getWithState(step, effect, EffectState.FINISHED, 0)
    case PowerUpEffectKind.BARREL:
      return advanceBarrel(step, effect)
    case PowerUpEffectKind.MAGNET:
      // 0x00455f50.
      return effect.state === EffectState.ENDING
        ? getWithState(step, effect, EffectState.FINISHED, effect.timerMilliseconds)
        : getWithState(step, effect, EffectState.ENDING, 1000)
    case PowerUpEffectKind.CURSE:
      // 0x00452ae0.
      return advanceThreeStages(step, effect, 15000, 1000)
    case PowerUpEffectKind.TURBO:
      return advanceTurbo(step, context, effect)
    default:
      // Shield 0x0045c2a0, warp 0x0045dc90.
      return advanceShieldOrWarp(step, effect)
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

// 0x00454d70 after the countdown: jitter draws, the hold on a struck racer, and sparks (0x00454e50).
const updateWand = (
  step: PowerUpStep,
  effectId: number,
  stepMilliseconds: number,
  duringBeam: WandBeamStep
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  let jitterMilliseconds = (effect.jitterMilliseconds + stepMilliseconds) >>> 0
  let draws = 0
  while (jitterMilliseconds > WAND_JITTER_PERIOD_MILLISECONDS) {
    draws += 1
    jitterMilliseconds -= WAND_JITTER_PERIOD_MILLISECONDS
  }
  const jittered = getStepWithDraws(step, draws)
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
      ...effect,
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
  return getStepWithEffect(sparkDraws.step, {
    ...current,
    sparkMilliseconds: ((sparkDraws.values[1] ?? 0) % 300) + 200,
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
  const counted = countDown(step, context, effectId, stepMilliseconds)
  if (effect.kind === PowerUpEffectKind.WAND) {
    return updateWand(counted, effectId, stepMilliseconds, duringWandBeam)
  }
  // 0x004572a0: two draws per frame while the bubble emitter exists.
  if (
    effect.kind === PowerUpEffectKind.OIL_SLICK &&
    getEffect(counted, effectId).isBubbleEmitterActive
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
  getStepWithDraws(
    step,
    step.world.effects.effects.filter((effect) => effect.kind === PowerUpEffectKind.WAND).length *
      WAND_INITIAL_DRAWS
  )

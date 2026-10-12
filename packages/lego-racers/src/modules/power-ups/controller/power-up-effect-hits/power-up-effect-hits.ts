import type { Vector3 } from '../../../simulation-math/index.ts'
import {
  EffectState,
  PowerUpEffectKind,
} from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type { PowerUpEffect, RacerPowerUpStatus } from '../../types/power-ups.types.ts'
import { releaseEffectEmitter, startEffectEmitter } from '../effect-emitters/effect-emitters.ts'
import {
  advancePowerUpEffect,
  retractGrapple,
} from '../power-up-effect-timeline/power-up-effect-timeline.ts'
import {
  getEffect,
  getStepDraws,
  getStepWithDroppedEnhancement,
  getStepWithEffect,
  getStepWithEvents,
  getStepWithShieldStruck,
  getStepWithVoice,
} from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'

// 0x0043a270 is followed by a reflection when the shield level (racer +0xd6c) is above 1.
const REFLECTING_SHIELD_LEVEL = 1
// 0x004b0404 and 0x004b02e0 in 0x0045b550.
const DEBRIS_SPREAD_PER_UNIT = Math.fround(0.004)
const DEBRIS_SPREAD_CENTRE = Math.fround(0.2)
const CURSE_MILLISECONDS = 10000
// The hazard touch 0x00456320 destroys hazards below level 3 when they meet a shield.
const SHIELD_PROOF_HAZARD_LEVEL = 3

const getStatus = (context: PowerUpContext, racer: number): RacerPowerUpStatus => {
  const status = context.racers[racer]
  if (status === undefined) throw new RangeError(`No racer status at index ${String(racer)}`)
  return status
}

const getWithOwnerTaunt = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep =>
  effect.ownerRacer === null ? step : getStepWithVoice(step, effect.ownerRacer, true)

// The unshielded branch shared by the cannon (0x00452370), wand (0x00455440) and rocket (0x00456fa0) hits.
const getStepWithVictimHit = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect,
  victim: number
): PowerUpStep =>
  getStepWithEvents(
    getStepWithDroppedEnhancement(
      getStepWithVoice(getWithOwnerTaunt(step, effect), victim, false),
      context,
      victim
    ),
    [{ type: 'power_ups.racer_hit', racer: victim }]
  )

// The shielded branch: the victim cheers and the shield takes the hit (0x0043a270).
const getStepWithShieldedVictim = (step: PowerUpStep, victim: number): PowerUpStep =>
  getStepWithShieldStruck(getStepWithVoice(step, victim, true), victim)

const getIsReflected = (status: RacerPowerUpStatus): boolean =>
  status.isShielded && status.shieldLevel > REFLECTING_SHIELD_LEVEL

// 0x0045b550: (table % 3) + 1 pieces, each launched along the direction with a random spread.
export const getStepWithDebris = (
  step: PowerUpStep,
  context: PowerUpContext,
  victim: number,
  direction: Vector3
): PowerUpStep => {
  const { add, subtract, multiply, storeFloat } = context.arithmetic
  const countDraw = getStepDraws(step, 1)
  const pieces = ((countDraw.values[0] ?? 0) % 3) + 1
  const spreadDraws = getStepDraws(countDraw.step, pieces * 2)
  const getSpread = (value: number, component: number): number =>
    storeFloat(
      subtract(add(multiply(value % 100, DEBRIS_SPREAD_PER_UNIT), component), DEBRIS_SPREAD_CENTRE)
    )
  const directions = Array.from({ length: pieces }, (_, piece) =>
    Object.freeze({
      x: getSpread(spreadDraws.values[piece * 2] ?? 0, direction.x),
      y: getSpread(spreadDraws.values[piece * 2 + 1] ?? 0, direction.y),
      z: 0,
    })
  )
  return getStepWithEvents(spreadDraws.step, [
    { type: 'power_ups.debris_thrown', racer: victim, directions: Object.freeze(directions) },
  ])
}

// 0x00452370 ends an unshielded hit with the cannon's hit sound (0x00451b50 plays it when the ball ends elsewhere).
const getStepWithCannonHitSound = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep =>
  effect.kind === PowerUpEffectKind.CANNON
    ? getStepWithEvents(step, [
        { type: 'power_ups.sound_played', soundId: 5, address: '0x0045241a' },
      ])
    : step

// Cannon 0x00452370 and rocket 0x00456fa0 (vtable slot 8), then the rest of their update when the hit is reported
// (0x00451b50, 0x004568f0): unless reflected, an explosion, debris from an unshielded victim, and the end.
const hitWithExplodingProjectile = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect,
  victim: number,
  debrisDirection: Vector3
): PowerUpStep => {
  const status = getStatus(context, victim)
  const isReflected = getIsReflected(status)
  const handled = status.isShielded
    ? getStepWithShieldedVictim(step, victim)
    : getStepWithCannonHitSound(
        getStepWithVictimHit(
          effect.kind === PowerUpEffectKind.ROCKET
            ? getStepWithEvents(step, [
                { type: 'power_ups.racer_spun_out', racer: victim, strength: 2, spinTime: 0 },
              ])
            : step,
          context,
          effect,
          victim
        ),
        effect
      )
  if (isReflected) {
    return getStepWithEvents(
      getStepWithEffect(handled, {
        ...getEffect(handled, effect.id),
        ownerRacer: victim,
        timerMilliseconds: 3000,
      }),
      [{ type: 'power_ups.projectile_reflected', effect: effect.id, owner: victim }]
    )
  }
  const exploded = getStepWithEvents(
    getStepWithEffect(handled, { ...getEffect(handled, effect.id), timerMilliseconds: 3000 }),
    [
      {
        type: 'power_ups.explosion',
        effect: effect.id,
        isSpiked: false,
        isGroundHit: false,
        offset: Object.freeze({ x: 0, y: 0, z: 0 }),
      },
    ]
  )
  const withDebris = status.isShielded
    ? exploded
    : getStepWithDebris(exploded, context, victim, debrisDirection)
  return advancePowerUpEffect(withDebris, context, effect.id)
}

// 0x004545d0: a shield sends the grapple back; otherwise it latches on for 4000 ms.
const hitWithGrapple = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect,
  victim: number
): PowerUpStep => {
  if (getStatus(context, victim).isShielded) {
    const shielded = getStepWithShieldedVictim(step, victim)
    return retractGrapple(shielded, getEffect(shielded, effect.id))
  }
  const hit = getStepWithDroppedEnhancement(
    getStepWithVoice(getWithOwnerTaunt(step, effect), victim, false),
    context,
    victim
  )
  return getStepWithEvents(
    getStepWithEffect(hit, {
      ...getEffect(hit, effect.id),
      state: EffectState.ENDING,
      timerMilliseconds: 4000,
      targetRacer: victim,
    }),
    effect.ownerRacer === null
      ? []
      : [{ type: 'power_ups.racer_grappled', racer: victim, owner: effect.ownerRacer }]
  )
}

// 0x00455440: a racer in the beam is struck once and held for 1000 ms.
const hitWithWand = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect,
  victim: number
): PowerUpStep => {
  const status = getStatus(context, victim)
  if (status.isShielded) return getStepWithShieldedVictim(step, victim)
  if (status.isStruckByLightning) return step
  const struck = getStepWithVictimHit(
    getStepWithEvents(step, [{ type: 'power_ups.racer_struck_by_lightning', racer: victim }]),
    context,
    effect,
    victim
  )
  const held = getStepWithEffect(struck, {
    ...getEffect(struck, effect.id),
    heldMilliseconds: 0,
    targetRacer: victim,
  })
  // The sparks of an earlier strike are let go before the new ones start.
  return startEffectEmitter(
    releaseEffectEmitter(held, effect.id, false),
    context.arithmetic,
    effect.id,
    'lghthit'
  )
}

// A projectile in flight (state 3) reached a racer; reported by the projectile code, which is not ported.
export const hitRacerWithProjectile = (
  step: PowerUpStep,
  context: PowerUpContext,
  effectId: number,
  victim: number,
  debrisDirection: Vector3
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  if (effect.state !== EffectState.ACTIVE) return step
  if (effect.kind === PowerUpEffectKind.GRAPPLE)
    return hitWithGrapple(step, context, effect, victim)
  if (effect.kind === PowerUpEffectKind.WAND) return hitWithWand(step, context, effect, victim)
  if (effect.kind === PowerUpEffectKind.CANNON || effect.kind === PowerUpEffectKind.ROCKET) {
    return hitWithExplodingProjectile(step, context, effect, victim, debrisDirection)
  }
  return step
}

// 0x00455fb0: the first touch arms the magnet for 4000 ms; a racer within 9 units (81 squared) is captured.
const touchMagnet = (
  step: PowerUpStep,
  effect: PowerUpEffect,
  victim: number,
  isWithinCaptureRange: boolean
): PowerUpStep => {
  if (effect.state === EffectState.ENDING) return step
  const armed =
    effect.state === EffectState.STARTING
      ? { ...effect, state: EffectState.ACTIVE, timerMilliseconds: 4000 }
      : effect
  const withArmed = getStepWithEffect(step, armed)
  if (armed.state !== EffectState.ACTIVE || !isWithinCaptureRange || armed.targetRacer !== null) {
    return withArmed
  }
  return getStepWithVoice(
    getStepWithEvents(getStepWithEffect(withArmed, { ...armed, targetRacer: victim }), [
      { type: 'power_ups.racer_magnetized', racer: victim },
    ]),
    victim,
    false
  )
}

// Vtable slot 8 of the hazards: oil slick 0x004575b0, magnet 0x00455fb0, curse 0x00452da0 (the barrel's is empty).
const hitWithHazard = (
  step: PowerUpStep,
  context: PowerUpContext,
  effect: PowerUpEffect,
  victim: number,
  isWithinCaptureRange: boolean
): PowerUpStep => {
  const status = getStatus(context, victim)
  if (effect.kind === PowerUpEffectKind.OIL_SLICK) {
    if (effect.state === EffectState.FINAL_STAGE || status.isTumbling) return step
    return getStepWithEvents(
      getStepWithEffect(step, { ...effect, state: EffectState.FINISHED, timerMilliseconds: 0 }),
      [
        { type: 'power_ups.racer_spun_out', racer: victim, strength: 1, spinTime: 1 },
        { type: 'power_ups.racer_hit', racer: victim },
      ]
    )
  }
  if (effect.kind === PowerUpEffectKind.MAGNET) {
    return touchMagnet(step, effect, victim, isWithinCaptureRange)
  }
  if (effect.kind !== PowerUpEffectKind.CURSE) return step
  if (effect.state === EffectState.FINAL_STAGE || status.isCursed) return step
  return getStepWithEvents(step, [
    { type: 'power_ups.racer_cursed', racer: victim, durationMilliseconds: CURSE_MILLISECONDS },
  ])
}

// 0x00456320 (vtable slot 0 of the hazards), called by the collision registry when a racer touches one.
export const touchHazardEffect = (
  step: PowerUpStep,
  context: PowerUpContext,
  effectId: number,
  victim: number,
  isWithinCaptureRange: boolean
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  if (victim === effect.ownerRacer) return step
  if (!getStatus(context, victim).isShielded) {
    return hitWithHazard(step, context, effect, victim, isWithinCaptureRange)
  }
  const struck = getStepWithShieldStruck(step, victim)
  if (effect.level >= SHIELD_PROOF_HAZARD_LEVEL) return struck
  return getStepWithEffect(struck, { ...getEffect(struck, effectId), state: EffectState.FINISHED })
}

// A cannon, rocket or barrel that ended its flight without hitting a racer (0x00451b50, 0x004568f0, 0x00452ff0).
export const endProjectileFlight = (
  step: PowerUpStep,
  context: PowerUpContext,
  effectId: number,
  isGroundHit: boolean
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  const isBarrel = effect.kind === PowerUpEffectKind.BARREL
  const sounded =
    effect.kind === PowerUpEffectKind.CANNON
      ? getStepWithEvents(step, [
          { type: 'power_ups.sound_played', soundId: 5, address: '0x00451c55' },
        ])
      : step
  const exploded = getStepWithEvents(sounded, [
    {
      type: 'power_ups.explosion',
      effect: effectId,
      isSpiked: isBarrel,
      isGroundHit: isBarrel || isGroundHit,
      offset: Object.freeze({ x: 0, y: 0, z: 0 }),
    },
  ])
  if (isBarrel) {
    // 0x00452ff0 lets the barrel's sparks go as it explodes.
    return releaseEffectEmitter(
      getStepWithEffect(exploded, {
        ...effect,
        state: EffectState.ENDING,
        timerMilliseconds: 500,
      }),
      effectId,
      false
    )
  }
  return advancePowerUpEffect(exploded, context, effectId)
}

import {
  advancePowerUpEffect,
  EffectState,
  getEffect,
  getStepWithEffect,
  hitRacerWithProjectile,
  updatePowerUpEffect,
} from '../../../power-ups/index.ts'
import type { PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import {
  getDotProduct,
  getNormalizedVector3,
  getSquaredLength,
  getStoredDifference,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { ProjectileEvent } from '../../events/projectile.events.types.ts'
import { BallisticFlightState } from '../../types/ballistic-flight/ballistic-flight.ts'
import {
  advanceGrappleHook,
  createGrappleHook,
  getRetractingHook,
} from '../../types/grapple-hook/grapple-hook.ts'
import type { GrappleHook } from '../../types/grapple-hook/grapple-hook.types.ts'
import {
  getMotion,
  getWorldWithEvents,
  getWorldWithMotion,
} from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'
import { getGrappleFlight } from '../ballistic-effects/ballistic-effects.ts'

// 0x004b1510: the pull stops, and the hook comes back, within 12 units (144 squared).
const MINIMUM_PULL_DISTANCE_SQUARED = 144
// 0x004b14ec: the strength of the tow.
const PULL_STRENGTH = 180

const getGrappleHook = (world: ProjectileWorld, effectId: number): GrappleHook | null => {
  const motion = getMotion(world, effectId)
  return motion !== null && motion.kind === 'grapple' ? motion.hook : null
}

const getWorldWithHook = (
  world: ProjectileWorld,
  effectId: number,
  hook: GrappleHook
): ProjectileWorld => getWorldWithMotion(world, effectId, Object.freeze({ kind: 'grapple', hook }))

// 0x00454690 (called with the point the hook starts back from): the effect retracts for 500 ms and the hook flies back.
const getRetracted = (
  context: ProjectileContext,
  current: ProjectileStep,
  effectId: number,
  point: Vector3
): ProjectileStep => {
  const hook = getGrappleHook(current.world, effectId)
  const step = advancePowerUpEffect(current.step, context.powerUps, effectId)
  return Object.freeze({
    step,
    world:
      hook === null
        ? current.world
        : getWorldWithHook(current.world, effectId, getRetractingHook(hook, point)),
  })
}

// 0x00453ef0 state 4: the latched racer and the owner are towed together until they are close, the victim is
// shielded, or the victim is behind the owner.
const getPulled = (
  context: ProjectileContext,
  current: ProjectileStep,
  effect: PowerUpEffect,
  victim: number
): ProjectileStep => {
  const { arithmetic } = context.powerUps
  const owner = effect.ownerRacer
  const ownerRacer = owner === null ? undefined : context.racers[owner]
  const ownerStatus = owner === null ? undefined : context.powerUps.racers[owner]
  const victimRacer = context.racers[victim]
  const victimStatus = context.powerUps.racers[victim]
  if (
    owner === null ||
    ownerRacer === undefined ||
    ownerStatus === undefined ||
    victimRacer === undefined ||
    victimStatus === undefined
  ) {
    return current
  }
  const retract = (): ProjectileStep =>
    getRetracted(context, current, effect.id, victimRacer.position)
  if (victimStatus.isShielded) return retract()
  const difference = getStoredDifference(arithmetic, victimRacer.position, ownerRacer.position)
  const rawDifference = Object.freeze({
    ...difference,
    z: arithmetic.subtract(victimRacer.position.z, ownerRacer.position.z),
  })
  if (
    arithmetic.getIsBelow(
      getSquaredLength(arithmetic, rawDifference),
      MINIMUM_PULL_DISTANCE_SQUARED
    )
  ) {
    return retract()
  }
  if (arithmetic.getIsBelow(getDotProduct(arithmetic, difference, ownerStatus.forward), 0)) {
    return retract()
  }
  const direction = getNormalizedVector3(arithmetic, difference)
  const { multiply, storeFloat } = arithmetic
  const tow = Object.freeze({
    x: storeFloat(multiply(PULL_STRENGTH, direction.x)),
    y: storeFloat(multiply(direction.y, PULL_STRENGTH)),
    z: storeFloat(multiply(direction.z, PULL_STRENGTH)),
  })
  const events: readonly ProjectileEvent[] = [
    { type: 'projectiles.racer_towed', racer: owner, vector: tow, isOwner: true },
    {
      type: 'projectiles.racer_towed',
      racer: victim,
      vector: Object.freeze({ x: -tow.x, y: -tow.y, z: -tow.z }),
      isOwner: false,
    },
  ]
  return Object.freeze({ step: current.step, world: getWorldWithEvents(current.world, events) })
}

// What the effect does with the hook's result after the hit (0x00453ef0, the switch on the effect's state).
const getStepAfterAdvance = (
  context: ProjectileContext,
  current: ProjectileStep,
  effectId: number,
  result: string,
  victim: number | null
): ProjectileStep => {
  const effect = getEffect(current.step, effectId)
  const hook = getGrappleHook(current.world, effectId)
  if (hook === null) return current
  if (effect.state === EffectState.FINAL_STAGE) {
    return result === BallisticFlightState.ENDED
      ? Object.freeze({
          step: getStepWithEffect(current.step, {
            ...effect,
            state: EffectState.FINISHED,
            timerMilliseconds: 0,
          }),
          world: current.world,
        })
      : current
  }
  if (effect.state !== EffectState.ACTIVE && effect.state !== EffectState.ENDING) return current
  if (result === BallisticFlightState.HIT_GROUND) {
    return getRetracted(context, current, effectId, hook.flight.endPosition)
  }
  if (effect.state === EffectState.ACTIVE || victim === null) return current
  return getPulled(context, current, effect, victim)
}

// 0x00453ef0 (grapple vtable slot 2) together with the start 0x00454360: the countdown, the launch when it leaves
// state 2, the hook's flight, the hit, and the pull.
export const updateGrapple = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileStep => {
  if (before.state === EffectState.FINISHED) return Object.freeze({ step, world })
  const counted = updatePowerUpEffect(step, context.powerUps, before.id, stepMilliseconds)
  const after = getEffect(counted, before.id)
  const flightMilliseconds =
    stepMilliseconds < before.timerMilliseconds
      ? stepMilliseconds
      : stepMilliseconds - before.timerMilliseconds
  const isLaunching = before.state === EffectState.STARTING && after.state === EffectState.ACTIVE
  const hookWorld = isLaunching
    ? getWorldWithHook(world, before.id, createGrappleHook(getGrappleFlight(context, after)))
    : world
  const existing = getGrappleHook(hookWorld, before.id)
  const isTimedOut =
    (before.state === EffectState.ACTIVE || before.state === EffectState.ENDING) &&
    after.state === EffectState.FINAL_STAGE
  const countedHook =
    existing !== null && isTimedOut
      ? getRetractingHook(existing, existing.flight.framePosition)
      : existing
  const started: ProjectileStep = Object.freeze({
    step: counted,
    world: countedHook === null ? hookWorld : getWorldWithHook(hookWorld, before.id, countedHook),
  })
  if (after.state === EffectState.STARTING || after.state === EffectState.FINISHED) return started
  if (countedHook === null) return started
  const ownerRacer = after.ownerRacer === null ? undefined : context.racers[after.ownerRacer]
  const touchedRacer =
    countedHook.flight.touchedRacer === null
      ? undefined
      : context.racers[countedHook.flight.touchedRacer]
  const advance = advanceGrappleHook(
    context.powerUps.arithmetic,
    context.probe,
    countedHook,
    ownerRacer?.position ?? ZERO_VECTOR3,
    touchedRacer?.position ?? null,
    flightMilliseconds
  )
  const flown: ProjectileStep = Object.freeze({
    step: counted,
    world: getWorldWithHook(started.world, before.id, advance.hook),
  })
  const victim = advance.hook.flight.touchedRacer
  if (advance.result !== BallisticFlightState.TOUCHED_RACER || victim === null) {
    return getStepAfterAdvance(context, flown, before.id, advance.result, victim)
  }
  const hit = hitRacerWithProjectile(flown.step, context.powerUps, before.id, victim, ZERO_VECTOR3)
  const hitState = getEffect(hit, before.id).state
  const afterHit: ProjectileStep =
    hitState === EffectState.FINAL_STAGE
      ? Object.freeze({
          step: hit,
          world: getWorldWithHook(
            flown.world,
            before.id,
            getRetractingHook(advance.hook, advance.hook.flight.framePosition)
          ),
        })
      : Object.freeze({ step: hit, world: flown.world })
  return getStepAfterAdvance(context, afterHit, before.id, advance.result, victim)
}

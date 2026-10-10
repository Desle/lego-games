import {
  EffectState,
  getEffect,
  PowerUpEffectKind,
  updatePowerUpEffect,
  updatePowerUps,
} from '../../../power-ups/index.ts'
import type { PowerUpContext, PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import { BallisticFlightState } from '../../types/ballistic-flight/ballistic-flight.ts'
import { getMotion, getWorldWithMotion } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'
import {
  advanceEffectFlight,
  getBarrelFlight,
  getCannonFlight,
  getStepAfterBarrelAdvance,
  getStepAfterCannonAdvance,
} from '../ballistic-effects/ballistic-effects.ts'

const getWithBallisticMotion = (
  world: ProjectileWorld,
  effectId: number,
  flight: ReturnType<typeof getCannonFlight>
): ProjectileWorld =>
  getWorldWithMotion(world, effectId, Object.freeze({ kind: 'ballistic', flight }))

// 0x00451b50 (cannon vtable slot 2): the countdown first, which calls the advance (0x00451f50) when the timer runs
// out; the advance launches the ball when the cannon leaves state 2, and the ball flies on in the same call with the
// time left after the countdown.
const updateCannon = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileStep => {
  const counted = updatePowerUpEffect(step, context.powerUps, before.id, stepMilliseconds)
  const after = getEffect(counted, before.id)
  const flightMilliseconds =
    stepMilliseconds < before.timerMilliseconds
      ? stepMilliseconds
      : stepMilliseconds - before.timerMilliseconds
  const launched =
    before.state === EffectState.STARTING && after.state === EffectState.ACTIVE
      ? getWithBallisticMotion(world, before.id, getCannonFlight(context, after))
      : world
  if (after.state !== EffectState.ACTIVE) return Object.freeze({ step: counted, world: launched })
  const advance = advanceEffectFlight(context, launched, before.id, flightMilliseconds)
  if (advance === null) return Object.freeze({ step: counted, world: launched })
  return getStepAfterCannonAdvance(
    counted,
    launched,
    context,
    before.id,
    advance.flight,
    advance.result
  )
}

// 0x00452ff0 (barrel vtable slot 2): the flight first, then the countdown (0x004513a0), whose advance (0x00453240)
// launches the barrel when it leaves state 2.
const updateBarrel = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileStep => {
  const motion = getMotion(world, before.id)
  const flown =
    motion !== null && motion.flight.state === BallisticFlightState.FLYING
      ? advanceEffectFlight(context, world, before.id, stepMilliseconds)
      : null
  const afterFlight =
    flown === null
      ? Object.freeze({ step, world })
      : getStepAfterBarrelAdvance(step, world, context, before.id, flown.flight, flown.result)
  const counted = updatePowerUpEffect(
    afterFlight.step,
    context.powerUps,
    before.id,
    stepMilliseconds
  )
  const after = getEffect(counted, before.id)
  return Object.freeze({
    step: counted,
    world:
      before.state === EffectState.STARTING && after.state === EffectState.ACTIVE
        ? getWithBallisticMotion(afterFlight.world, before.id, getBarrelFlight(context, after))
        : afterFlight.world,
  })
}

const getWorldWithFinishedMotionCleared = (
  world: ProjectileWorld,
  step: PowerUpStep,
  effectId: number
): ProjectileWorld =>
  getEffect(step, effectId).state === EffectState.FINISHED
    ? getWorldWithMotion(world, effectId, null)
    : world

// Vtable slot 2 of one active effect, with the movement the power-ups module does not port.
export const updateProjectileEffect = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  effectId: number,
  stepMilliseconds: number
): ProjectileStep => {
  const before = getEffect(step, effectId)
  const updated: ProjectileStep =
    before.kind === PowerUpEffectKind.CANNON
      ? updateCannon(step, world, context, before, stepMilliseconds)
      : before.kind === PowerUpEffectKind.BARREL
        ? updateBarrel(step, world, context, before, stepMilliseconds)
        : Object.freeze({
            step: updatePowerUpEffect(step, context.powerUps, effectId, stepMilliseconds),
            world,
          })
  return Object.freeze({
    step: updated.step,
    world: getWorldWithFinishedMotionCleared(updated.world, updated.step, effectId),
  })
}

// PowerUps_Update 0x0045a490 with the moving effects: every active effect, head first, then the power-ups' own
// frame work around it.
export const updatePowerUpsWithProjectiles = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  stepMilliseconds: number
): ProjectileStep => {
  let currentWorld = world
  const updated = updatePowerUps(
    step,
    context.powerUps,
    stepMilliseconds,
    (effectsStep, _powerUpContext: PowerUpContext, effectsMilliseconds) =>
      effectsStep.world.effects.activeEffectIds.reduce((current, effectId) => {
        const result = updateProjectileEffect(
          current,
          currentWorld,
          context,
          effectId,
          effectsMilliseconds
        )
        currentWorld = result.world
        return result.step
      }, effectsStep)
  )
  return Object.freeze({ step: updated, world: currentWorld })
}

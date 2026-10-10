import {
  advancePowerUpEffect,
  EffectState,
  getEffect,
  getStepWithEffect,
  getStepWithRacerTurbosEnded,
  PowerUpEffectKind,
  updatePowerUpEffect,
  updatePowerUps,
} from '../../../power-ups/index.ts'
import type { PowerUpContext, PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import { BallisticFlightState } from '../../types/ballistic-flight/ballistic-flight.ts'
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
import { updateGrapple } from '../grapple-effect/grapple-effect.ts'
import { getIsSpeedNearZero } from '../../types/turbo-early-end/turbo-early-end.ts'
import {
  createMagnetMotion,
  getMagnetLandingBoost,
  getMagnetPull,
} from '../../types/magnet-pull/magnet-pull.ts'
import type { MagnetPullRacer } from '../../types/magnet-pull/magnet-pull.types.ts'
import {
  advanceEffectFlight,
  getBarrelFlight,
  getCannonFlight,
  getStepAfterBarrelAdvance,
  getStepAfterCannonAdvance,
} from '../ballistic-effects/ballistic-effects.ts'

// 0x00455b40: the magnet is placed while its timer still holds the 20,000 ms of its start.
const MAGNET_PLACEMENT_TIMER = 20000
// 0x0045ce20: the early end only applies while less than 4500 ms (0x1194) are left.
const TURBO_EARLY_END_TIMER_LIMIT = 4500

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
    motion !== null && motion.kind === 'ballistic' && motion.flight.state === BallisticFlightState.FLYING
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

const getMagnetRacers = (context: ProjectileContext): readonly MagnetPullRacer[] =>
  context.racers.map((flight, index) => ({
    flight,
    isTumbling: context.powerUps.racers[index]?.isTumbling ?? false,
    isInTurbo: context.powerUps.racers[index]?.isInTurbo ?? false,
  }))

// 0x00455b40 (magnet vtable slot 2): placed under its owner on the first update (before the countdown), then the
// countdown, then the pull.
const updateMagnet = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileStep => {
  if (before.state === EffectState.FINISHED) return Object.freeze({ step, world })
  const ownerStatus =
    before.ownerRacer === null ? undefined : context.powerUps.racers[before.ownerRacer]
  const placed =
    before.state === EffectState.STARTING &&
    before.timerMilliseconds === MAGNET_PLACEMENT_TIMER &&
    before.ownerRacer !== null &&
    ownerStatus !== undefined
      ? getWorldWithEvents(
          getWorldWithMotion(
            world,
            before.id,
            createMagnetMotion(
              context.powerUps.arithmetic,
              ownerStatus.position,
              context.powerUps.getGroundPoint
            )
          ),
          [getMagnetLandingBoost(before.ownerRacer)]
        )
      : world
  const counted = updatePowerUpEffect(step, context.powerUps, before.id, stepMilliseconds)
  const motion = getMotion(placed, before.id)
  const after = getEffect(counted, before.id)
  if (motion === null || motion.kind !== 'magnet') {
    return Object.freeze({ step: counted, world: placed })
  }
  const pull = getMagnetPull(
    context.powerUps.arithmetic,
    motion,
    after.targetRacer,
    after.timerMilliseconds,
    getMagnetRacers(context),
    stepMilliseconds
  )
  const timed = getStepWithEffect(counted, { ...after, timerMilliseconds: pull.timerMilliseconds })
  return Object.freeze({
    step:
      pull.turboEndedRacer === null
        ? timed
        : getStepWithRacerTurbosEnded(timed, pull.turboEndedRacer),
    world: getWorldWithEvents(getWorldWithMotion(placed, before.id, pull.motion), pull.events),
  })
}

// 0x0045ce20 (turbo vtable slot 2): after the countdown, a tumbling racer who has stopped ends the turbo early.
const updateTurbo = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileStep => {
  const counted = updatePowerUpEffect(step, context.powerUps, before.id, stepMilliseconds)
  const after = getEffect(counted, before.id)
  const owner = after.ownerRacer === null ? undefined : context.racers[after.ownerRacer]
  const status = after.ownerRacer === null ? undefined : context.powerUps.racers[after.ownerRacer]
  if (
    before.state === EffectState.FINISHED ||
    owner === undefined ||
    status === undefined ||
    !status.isTumbling ||
    after.state !== EffectState.ACTIVE ||
    after.timerMilliseconds >= TURBO_EARLY_END_TIMER_LIMIT ||
    !getIsSpeedNearZero(context.powerUps.arithmetic, owner.speed)
  ) {
    return Object.freeze({ step: counted, world })
  }
  return Object.freeze({ step: advancePowerUpEffect(counted, context.powerUps, after.id), world })
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
        : before.kind === PowerUpEffectKind.GRAPPLE
          ? updateGrapple(step, world, context, before, stepMilliseconds)
          : before.kind === PowerUpEffectKind.MAGNET
          ? updateMagnet(step, world, context, before, stepMilliseconds)
          : before.kind === PowerUpEffectKind.TURBO
            ? updateTurbo(step, world, context, before, stepMilliseconds)
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

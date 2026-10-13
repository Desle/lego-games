import {
  advancePowerUpEffect,
  checkEffectEmitter,
  startEffectEmitter,
  EffectState,
  getEffect,
  getStepWithEffect,
  getStepWithRacerTurbosEnded,
  PowerUpEffectKind,
  updatePowerUpEffect,
  updatePowerUps,
} from '../../../power-ups/index.ts'
import type {
  EffectEmitterOwner,
  PowerUpContext,
  PowerUpEffect,
  PowerUpStep,
} from '../../../power-ups/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { BallisticFlightState } from '../../types/ballistic-flight/ballistic-flight.ts'
import {
  getMotion,
  getWorldWithEvents,
  getWorldWithBarrelSpin,
  getWorldWithMotion,
} from '../../types/projectile-world/projectile-world.ts'
import type {
  EffectUpdate,
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'
import {
  getStepWithConsequences,
  getStepWithExplosionsAndDebris,
} from '../projectile-consequences/projectile-consequences.ts'
import { getBarrelSpun, NO_BARREL_SPIN } from '../../types/barrel-spin/barrel-spin.ts'
import { updateRocket } from '../rocket-effect/rocket-effect.ts'
import { updateWarp } from '../warp-effect/warp-effect.ts'
import { updateWand } from '../wand-effect/wand-effect.ts'
import { updateGrapple } from '../grapple-effect/grapple-effect.ts'
import { getIsSpeedNearZero } from '../../types/turbo-early-end/turbo-early-end.ts'
import {
  createMagnetMotion,
  getHazardLanding,
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
// 0x0045ce20: the smoke needs a level 2 turbo with less than 800 ms left and no bit 2 in the race mode flags.
const TURBO_SMOKE_LEVEL = 2
const TURBO_SMOKE_TIMER_LIMIT = 800
const TURBO_SMOKE_BLOCKING_MODE_FLAG = 2

const getWithBallisticMotion = (
  world: ProjectileWorld,
  effectId: number,
  flight: ReturnType<typeof getCannonFlight>
): ProjectileWorld =>
  getWorldWithMotion(world, effectId, Object.freeze({ kind: 'ballistic', flight }))

// 0x00451b50 (cannon vtable slot 2): the countdown first, which calls the advance (0x00451f50) when the timer runs
// out; the advance launches the ball when the cannon leaves state 2, and the ball flies on in the same call with the
// time left after the countdown.
const flyCannon: EffectUpdate = (step, world, context, before, stepMilliseconds) => {
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

// The racer whose frame an effect's smoke follows (the effect's +0x24).
const getEmitterOwner = (
  context: ProjectileContext,
  ownerRacer: number | null
): EffectEmitterOwner | null => {
  const racer = ownerRacer === null ? undefined : context.racers[ownerRacer]
  return racer === undefined
    ? null
    : { position: racer.position, rotation: racer.displayRotation, velocity: racer.velocity }
}

// The tail of 0x00451b50: the smoke is let go once its emitter has born enough particles.
const updateCannon: EffectUpdate = (step, world, context, before, stepMilliseconds) => {
  const flown = flyCannon(step, world, context, before, stepMilliseconds)
  return Object.freeze({
    step: checkEffectEmitter(
      flown.step,
      before.id,
      context.powerUps.arithmetic,
      getEmitterOwner(context, before.ownerRacer)
    ),
    world: flown.world,
  })
}

// 0x00452ff0 (barrel vtable slot 2): the flight first, then the countdown (0x004513a0), whose advance (0x00453240)
// launches the barrel when it leaves state 2.
const updateBarrel: EffectUpdate = (step, world, context, before, stepMilliseconds) => {
  const motion = getMotion(world, before.id)
  const flown =
    motion !== null &&
    motion.kind === 'ballistic' &&
    motion.flight.state !== BallisticFlightState.IDLE
      ? advanceEffectFlight(context, world, before.id, stepMilliseconds)
      : null
  const afterFlight =
    flown === null
      ? Object.freeze({ step, world })
      : getStepAfterBarrelAdvance(step, world, context, before.id, flown.flight, flown.result)
  // 0x00452ff0 spins the model after the flight, whatever the flight did, in every state but the last.
  const spunWorld =
    before.state === EffectState.FINISHED
      ? afterFlight.world
      : getWorldWithBarrelSpin(
          afterFlight.world,
          before.id,
          getBarrelSpun(
            context.powerUps.arithmetic,
            context.getTableCosine,
            afterFlight.world.barrelSpins[before.id] ?? NO_BARREL_SPIN,
            stepMilliseconds
          )
        )
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
        ? getWithBallisticMotion(spunWorld, before.id, getBarrelFlight(context, after))
        : spunWorld,
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
const updateMagnet: EffectUpdate = (step, world, context, before, stepMilliseconds) => {
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

// 0x0045ce20: the last 800 ms of a level 2 turbo trail smoke, unless the race mode keeps turbos endless.
const getStepWithTurboSmoke = (
  step: PowerUpStep,
  context: ProjectileContext,
  effectId: number
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  const isSmoking =
    effect.level === TURBO_SMOKE_LEVEL &&
    effect.state === EffectState.ACTIVE &&
    effect.emitterHandleIndex === null &&
    effect.timerMilliseconds < TURBO_SMOKE_TIMER_LIMIT &&
    (context.powerUps.raceModeFlags & TURBO_SMOKE_BLOCKING_MODE_FLAG) === 0
  return isSmoking
    ? startEffectEmitter(step, context.powerUps.arithmetic, effectId, 'trbsmke')
    : step
}

// 0x0045ce20 (turbo vtable slot 2): after the countdown, a tumbling racer who has stopped ends the turbo early.
const updateTurbo: EffectUpdate = (step, world, context, before, stepMilliseconds) => {
  const counted = getStepWithTurboSmoke(
    updatePowerUpEffect(step, context.powerUps, before.id, stepMilliseconds),
    context,
    before.id
  )
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

// The tail of 0x00453ef0 (a finished grapple does nothing).
const updateGrappleWithSmoke: EffectUpdate = (step, world, context, before, stepMilliseconds) => {
  const flown = updateGrapple(step, world, context, before, stepMilliseconds)
  return before.state === EffectState.FINISHED
    ? flown
    : Object.freeze({
        step: checkEffectEmitter(
          flown.step,
          before.id,
          context.powerUps.arithmetic,
          getEmitterOwner(context, before.ownerRacer)
        ),
        world: flown.world,
      })
}

// 0x00452ae0 reads the owner's route node (racer +0xcc4) plane normal, or +x without one.
// The frame of a dropped curse in the emulator: axes (0, -1, 0), (1, 0, 0), (0, 0, 1) (first = up x this).
const UP: Vector3 = Object.freeze({ x: 0, y: 0, z: 1 })
const DROPPED_CURSE_ROUTE_NORMAL: Vector3 = Object.freeze({ x: -1, y: 0, z: 0 })
const FORWARD_WITHOUT_ROUTE: Vector3 = Object.freeze({ x: 1, y: 0, z: 0 })

// 0x004573a0 and 0x00452ae0: the slick or the curse lands on the ground under the racer it was thrown from (0x00456360)
// as it leaves state 2.
const updateHazard: EffectUpdate = (step, world, context, before, stepMilliseconds) => {
  const counted = updatePowerUpEffect(step, context.powerUps, before.id, stepMilliseconds)
  const after = getEffect(counted, before.id)
  const placedRacer = before.targetRacer ?? before.ownerRacer
  const racer = placedRacer === null ? undefined : context.racers[placedRacer]
  const isLanding = before.state === EffectState.STARTING && after.state === EffectState.ACTIVE
  if (isLanding && before.launcherPosition !== null) {
    // 0x00452ae0 without an owner: the shape sits where the dropper put it (0x00452550 → 0x00411cc0).
    return Object.freeze({
      step: counted,
      world: getWorldWithMotion(
        world,
        before.id,
        Object.freeze({
          kind: 'hazard',
          position: before.launcherPosition,
          groundNormal: UP,
          routeNormal: DROPPED_CURSE_ROUTE_NORMAL,
          landingMilliseconds: stepMilliseconds,
        })
      ),
    })
  }
  if (!isLanding || racer === undefined) return Object.freeze({ step: counted, world })
  const landing = getHazardLanding(
    context.powerUps.arithmetic,
    racer.position,
    context.powerUps.getGroundPoint
  )
  const routeNode = racer.routeNodeIndex === null ? undefined : context.route[racer.routeNodeIndex]
  return Object.freeze({
    step: counted,
    world: getWorldWithMotion(
      world,
      before.id,
      Object.freeze({
        kind: 'hazard',
        position: landing.position,
        groundNormal: landing.normal,
        routeNormal: routeNode?.normal ?? FORWARD_WITHOUT_ROUTE,
        landingMilliseconds: stepMilliseconds,
      })
    ),
  })
}

const updateWithPowerUps: EffectUpdate = (step, world, context, before, stepMilliseconds) =>
  Object.freeze({
    step: updatePowerUpEffect(step, context.powerUps, before.id, stepMilliseconds),
    world,
  })

// The effects with movement of their own; the others (oil slick, curse, shield) only count down.
const EFFECT_UPDATES: Readonly<Partial<Record<PowerUpEffect['kind'], EffectUpdate>>> =
  Object.freeze({
    [PowerUpEffectKind.CANNON]: updateCannon,
    [PowerUpEffectKind.OIL_SLICK]: updateHazard,
    [PowerUpEffectKind.CURSE]: updateHazard,
    [PowerUpEffectKind.BARREL]: updateBarrel,
    [PowerUpEffectKind.ROCKET]: updateRocket,
    [PowerUpEffectKind.WARP]: updateWarp,
    [PowerUpEffectKind.WAND]: updateWand,
    [PowerUpEffectKind.GRAPPLE]: updateGrappleWithSmoke,
    [PowerUpEffectKind.MAGNET]: updateMagnet,
    [PowerUpEffectKind.TURBO]: updateTurbo,
  })

// Vtable slot 2 of one active effect, with the movement the power-ups module does not port, and the explosions and
// debris its events start.
export const updateProjectileEffect = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  effectId: number,
  stepMilliseconds: number
): ProjectileStep => {
  const before = getEffect(step, effectId)
  const update = EFFECT_UPDATES[before.kind] ?? updateWithPowerUps
  const updated = getStepWithConsequences(
    update(step, world, context, before, stepMilliseconds),
    step.events.length,
    context
  )
  return Object.freeze({
    step: updated.step,
    world: getWorldWithFinishedMotionCleared(updated.world, updated.step, effectId),
  })
}

// PowerUps_Update 0x0045a490 with the moving effects: every active effect, head first, then the explosions and the
// debris, before the power-ups recycle their finished effects.
export const updatePowerUpsWithProjectiles = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  stepMilliseconds: number
): ProjectileStep => {
  let currentWorld: ProjectileWorld = Object.freeze({ ...world, events: Object.freeze([]) })
  const updated = updatePowerUps(
    step,
    context.powerUps,
    stepMilliseconds,
    (effectsStep, _powerUpContext: PowerUpContext, effectsMilliseconds) => {
      const effectsDone = effectsStep.world.effects.activeEffectIds.reduce((current, effectId) => {
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
      const settled = getStepWithExplosionsAndDebris(
        Object.freeze({ step: effectsDone, world: currentWorld }),
        context,
        effectsMilliseconds
      )
      currentWorld = settled.world
      return settled.step
    }
  )
  return Object.freeze({ step: updated, world: currentWorld })
}

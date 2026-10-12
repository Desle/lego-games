import type { Vector3 } from '../../../simulation-math/index.ts'
import { getIsAttachmentRoomFor } from '../../types/attachment-slots/attachment-slots.ts'
import { BrickKind } from '../../types/brick-kind/brick-kind.ts'
import {
  BARREL_WINDOW,
  CANNON_RACER_WINDOW,
  getFarthestInCone,
  getNearestInCone,
  GRAPPLE_FARTHEST_WINDOW,
  GRAPPLE_NEAREST_WINDOW,
  TRACK_TARGET_WINDOW,
} from '../../types/cone-query/cone-query.ts'
import {
  EffectState,
  getPowerUpEffectKind,
  PowerUpEffectKind,
} from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type {
  ActivationRequest,
  ConeQueryWindow,
  PowerUpEffect,
  PowerUpEffectKind as PowerUpEffectKindValue,
  RacerPowerUpStatus,
} from '../../types/power-ups.types.ts'
import {
  getStepWithAttachments,
  getStepWithRacerEffectsFinished,
  takePowerUpEffect,
} from '../power-up-effects/power-up-effects.ts'
import { getEffect, getStepWithEffect, getStepWithEvents } from '../power-up-step/power-up-step.ts'
import type { WarpDestination } from '../../types/power-ups.types.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import type { ActivationTarget, EffectStart } from './activate-power-up.types.ts'

// 0x0045bd30.
const SHIELD_MILLISECONDS: readonly number[] = Object.freeze([4000, 6000, 8000, 10000])
// 0x0045cd70: the car body boost (0x00429cf0) lasts 0x7d ms at level 0, 0xfa ms above.
const getTurboBoostMilliseconds = (level: number): number => (level === 0 ? 125 : 250)
const ROCKETS_PER_USE = 3
// 0x0045b030 needs 2 free attachment slots; 0x0045a9b0 (magnet, curse) and 0x0045b1e0 (turbo) need 3.
const SHIELD_REQUIRED_SLOTS = 2
const OTHER_REQUIRED_SLOTS = 3

const getStatus = (context: PowerUpContext, racer: number): RacerPowerUpStatus => {
  const status = context.racers[racer]
  if (status === undefined) throw new RangeError(`No racer status at index ${String(racer)}`)
  return status
}

const getNearestRacer = (
  context: PowerUpContext,
  status: RacerPowerUpStatus,
  window: ConeQueryWindow,
  direction: Vector3 = status.forward
): number | null => {
  const index = getNearestInCone(context.arithmetic, {
    origin: status.position,
    direction,
    window,
    targets: context.racers,
  })
  return index < 0 ? null : index
}

const getNearestTrackTarget = (
  context: PowerUpContext,
  status: RacerPowerUpStatus
): number | null => {
  const index = getNearestInCone(context.arithmetic, {
    origin: status.position,
    direction: status.forward,
    window: TRACK_TARGET_WINDOW,
    targets: context.trackTargets,
  })
  return index < 0 ? null : index
}

// 0x0045aa30: a human aims at a track target first; anyone then aims at the nearest racer.
const getCannonTarget = (context: PowerUpContext, racer: number): ActivationTarget => {
  const status = getStatus(context, racer)
  const trackTarget = status.isComputer ? null : getNearestTrackTarget(context, status)
  if (trackTarget !== null) return { racer: null, trackTarget }
  return { racer: getNearestRacer(context, status, CANNON_RACER_WINDOW), trackTarget: null }
}

// 0x0045ab50: the farthest racer in a narrow cone, else the nearest in a wide one, else (humans) a track target.
const getGrappleTarget = (context: PowerUpContext, racer: number): ActivationTarget => {
  const status = getStatus(context, racer)
  const farthest = getFarthestInCone(context.arithmetic, {
    origin: status.position,
    direction: status.forward,
    window: GRAPPLE_FARTHEST_WINDOW,
    targets: context.racers,
  })
  if (farthest >= 0) return { racer: farthest, trackTarget: null }
  const nearest = getNearestRacer(context, status, GRAPPLE_NEAREST_WINDOW)
  if (nearest !== null) return { racer: nearest, trackTarget: null }
  return {
    racer: null,
    trackTarget: status.isComputer ? null : getNearestTrackTarget(context, status),
  }
}

const getTakeLevels = (kind: PowerUpEffectKindValue, level: number): readonly number[] => {
  if (kind === PowerUpEffectKind.SHIELD) return [0, 1, 2, 3]
  if (kind === PowerUpEffectKind.TURBO) return [0, 1, 2, -1]
  return [level, -1, -1, -1]
}

const startEffect = (
  step: PowerUpStep,
  kind: PowerUpEffectKindValue,
  start: EffectStart
): PowerUpStep => {
  const taken = takePowerUpEffect(step, { kind, levels: getTakeLevels(kind, start.level) })
  const effect: PowerUpEffect = {
    ...getEffect(taken.step, taken.effectId),
    state: start.state,
    timerMilliseconds: start.timerMilliseconds,
    level: start.level,
    ownerRacer: start.ownerRacer,
    targetRacer: start.targetRacer,
    targetTrackPoint: start.targetTrackPoint,
    rocketIndex: start.rocketIndex,
    sparkMilliseconds: 0,
  }
  return getStepWithEffect(taken.step, effect)
}

const getPlainStart = (
  racer: number,
  level: number,
  timerMilliseconds: number,
  targetRacer: number | null
): EffectStart => ({
  state: EffectState.STARTING,
  timerMilliseconds,
  level,
  ownerRacer: racer,
  targetRacer,
  targetTrackPoint: null,
  rocketIndex: 0,
})

// Classes that take attachment slots first and finish at once when they cannot (shield, turbo, magnet, curse).
const startAttachedEffect = (
  step: PowerUpStep,
  kind: PowerUpEffectKindValue,
  start: EffectStart,
  onStarted: (started: PowerUpStep, effectId: number) => PowerUpStep
): PowerUpStep => {
  const taken = takePowerUpEffect(step, { kind, levels: getTakeLevels(kind, start.level) })
  const allocated = getStepWithAttachments(taken.step, taken.effectId)
  const effect = getEffect(allocated, taken.effectId)
  if (effect.state === EffectState.FINISHED) {
    return getStepWithEffect(allocated, { ...effect, level: start.level })
  }
  // The owner is set while the new effect is still idle, so the racer's earlier effects can be finished first.
  const started = onStarted(
    getStepWithEffect(allocated, {
      ...effect,
      timerMilliseconds: start.timerMilliseconds,
      level: start.level,
      ownerRacer: start.ownerRacer,
      targetRacer: start.targetRacer,
    }),
    taken.effectId
  )
  return getStepWithEffect(started, { ...getEffect(started, taken.effectId), state: start.state })
}

// 0x0045b030 → 0x0045bd30.
const activateShield = (
  step: PowerUpStep,
  context: PowerUpContext,
  racer: number,
  level: number
): PowerUpStep => {
  if (!getIsAttachmentRoomFor(step.world.effects.attachmentSlots, SHIELD_REQUIRED_SLOTS))
    return step
  const status = getStatus(context, racer)
  const start = {
    ...getPlainStart(racer, level, SHIELD_MILLISECONDS[level] ?? 0, null),
    state: EffectState.ACTIVE,
  }
  return startAttachedEffect(step, PowerUpEffectKind.SHIELD, start, (started) => {
    const replaced = status.isShielded
      ? getStepWithRacerEffectsFinished(
          started,
          PowerUpEffectKind.SHIELD,
          racer,
          (effect) => effect.ownerRacer,
          false
        )
      : started
    return getStepWithEvents(replaced, [
      { type: 'power_ups.racer_shield_raised', racer, level },
      ...(status.isCursed ? [{ type: 'power_ups.racer_curse_lifted' as const, racer }] : []),
    ])
  })
}

// 0x0045b690 then 0x00439730: the racer's turbo effects finish at once and its turbo state ends.
export const getStepWithRacerTurbosEnded = (step: PowerUpStep, racer: number): PowerUpStep =>
  getStepWithEvents(
    getStepWithRacerEffectsFinished(
      step,
      PowerUpEffectKind.TURBO,
      racer,
      (effect) => effect.ownerRacer,
      true
    ),
    [{ type: 'power_ups.racer_turbo_ended', racer }]
  )

// 0x0045b1e0 → 0x0045c8f0 and 0x0045cd70.
const activateTurbo = (
  step: PowerUpStep,
  context: PowerUpContext,
  racer: number,
  level: number
): PowerUpStep => {
  if (!getIsAttachmentRoomFor(step.world.effects.attachmentSlots, OTHER_REQUIRED_SLOTS)) return step
  const status = getStatus(context, racer)
  return startAttachedEffect(
    step,
    PowerUpEffectKind.TURBO,
    getPlainStart(racer, level, 400, null),
    (started) => {
      const replaced = status.isInTurbo ? getStepWithRacerTurbosEnded(started, racer) : started
      return getStepWithEvents(replaced, [
        {
          type: 'power_ups.racer_turbo_started',
          racer,
          level,
          boostMilliseconds: getTurboBoostMilliseconds(level),
        },
      ])
    }
  )
}

// 0x0045b260 → 0x0045d560: a racer's own warp waits 500 ms (power-up system +0x1998 is null) and carries it ahead on the
// track; with a launcher (the warp pad, 0x0048af80) there is no wait and the racer is carried to the launcher's
// destination.
const startWarp = (
  step: PowerUpStep,
  context: PowerUpContext,
  racer: number,
  warpDestination: WarpDestination | null
): PowerUpStep => {
  const status = getStatus(context, racer)
  const taken = takePowerUpEffect(step, { kind: PowerUpEffectKind.WARP, levels: [3, -1, -1, -1] })
  const effect = getEffect(taken.step, taken.effectId)
  if (status.isWarping || status.isWarpPending) {
    return getStepWithEffect(taken.step, { ...effect, state: EffectState.FINISHED, level: 3 })
  }
  const released = getStepWithRacerEffectsFinished(
    taken.step,
    PowerUpEffectKind.MAGNET,
    racer,
    (candidate) => candidate.targetRacer,
    false
  )
  return getStepWithEvents(
    getStepWithEffect(released, {
      ...getEffect(released, taken.effectId),
      ...getPlainStart(racer, 3, warpDestination === null ? 500 : 0, null),
      warpDestination,
    }),
    [{ type: 'power_ups.racer_warp_pending', racer }]
  )
}

const activateWarp = (step: PowerUpStep, context: PowerUpContext, racer: number): PowerUpStep =>
  startWarp(step, context, racer, null)

export const activateLauncherWarp = (
  step: PowerUpStep,
  context: PowerUpContext,
  racer: number,
  destination: Vector3,
  forward: Vector3
): PowerUpStep =>
  startWarp(step, context, racer, Object.freeze({ destination, forward, start: null }))

// 0x0045af80: three rockets, each taken separately, numbered 0..2.
const activateRockets = (step: PowerUpStep, racer: number): PowerUpStep =>
  Array.from({ length: ROCKETS_PER_USE }, (_, rocketIndex) => rocketIndex).reduce(
    (current, rocketIndex) =>
      // 0x00456560 (each rocket's set-up) ends with sound 0x33.
      getStepWithEvents(
        startEffect(current, PowerUpEffectKind.ROCKET, {
          ...getPlainStart(racer, 3, 3000, null),
          rocketIndex,
        }),
        [{ type: 'power_ups.sound_played', soundId: 0x33, address: '0x00456668' }]
      ),
    step
  )

const activateProjectile = (
  step: PowerUpStep,
  context: PowerUpContext,
  racer: number,
  level: number
): PowerUpStep => {
  if (level === 0) {
    const target = getCannonTarget(context, racer)
    return startEffect(step, PowerUpEffectKind.CANNON, {
      ...getPlainStart(racer, 0, 0, target.racer),
      targetTrackPoint: target.trackTarget,
    })
  }
  if (level === 1) {
    const target = getGrappleTarget(context, racer)
    return startEffect(step, PowerUpEffectKind.GRAPPLE, {
      ...getPlainStart(racer, 1, 0, target.racer),
      targetTrackPoint: target.trackTarget,
    })
  }
  if (level === 2) {
    // 0x00454cb0 (Wand_Start) plays the wand's hum (sound 0x44, made with the effect) in a loop.
    return getStepWithEvents(
      startEffect(step, PowerUpEffectKind.WAND, getPlainStart(racer, 2, 500, null)),
      [
        {
          type: 'power_ups.looped_sound_started',
          key: `wand:${String(racer)}`,
          soundId: 0x44,
          address: '0x00454d03',
          ownerRacer: racer,
        },
      ]
    )
  }
  return level === 3 ? activateRockets(step, racer) : step
}

const activateHazard = (
  step: PowerUpStep,
  context: PowerUpContext,
  racer: number,
  level: number
): PowerUpStep => {
  if (level === 0)
    return startEffect(step, PowerUpEffectKind.OIL_SLICK, getPlainStart(racer, 0, 0, null))
  if (level === 1) {
    // 0x0045ad30 looks behind the racer: the barrel is thrown backwards.
    const status = getStatus(context, racer)
    const { forward } = status
    const target = getNearestRacer(
      context,
      status,
      BARREL_WINDOW,
      Object.freeze({ x: -forward.x, y: -forward.y, z: -forward.z })
    )
    return startEffect(step, PowerUpEffectKind.BARREL, getPlainStart(racer, 1, 0, target))
  }
  if (level !== 2 && level !== 3) return step
  if (!getIsAttachmentRoomFor(step.world.effects.attachmentSlots, OTHER_REQUIRED_SLOTS)) return step
  const kind = getPowerUpEffectKind(BrickKind.HAZARD, level)
  const timerMilliseconds = kind === PowerUpEffectKind.MAGNET ? 20000 : 0
  return startAttachedEffect(
    step,
    kind,
    getPlainStart(racer, level, timerMilliseconds, null),
    (started, effectId) =>
      kind === PowerUpEffectKind.MAGNET
        ? getStepWithEvents(started, [
            // 0x004560b0 (the magnet's placing): sound 0x21, and sound 0x22 loops while it lasts.
            { type: 'power_ups.sound_played', soundId: 0x21, address: '0x0045622a' },
            {
              type: 'power_ups.looped_sound_started',
              key: `magnet:${String(effectId)}`,
              soundId: 0x22,
              address: '0x0045623d',
              ownerRacer: racer,
            },
          ])
        : started
  )
}

// What 0x00439100 calls: 0x0045a950, 0x0045a9b0, 0x0045b030 or 0x0045b1e0 with the racer and a level.
export const activatePowerUp = (
  step: PowerUpStep,
  context: PowerUpContext,
  racer: number,
  request: ActivationRequest
): PowerUpStep => {
  if (request.category === BrickKind.PROJECTILE) {
    return activateProjectile(step, context, racer, request.level)
  }
  if (request.category === BrickKind.HAZARD)
    return activateHazard(step, context, racer, request.level)
  if (request.category === BrickKind.SHIELD)
    return activateShield(step, context, racer, request.level)
  return request.level === 3
    ? activateWarp(step, context, racer)
    : activateTurbo(step, context, racer, request.level)
}

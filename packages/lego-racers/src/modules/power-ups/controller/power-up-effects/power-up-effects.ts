import type { PowerUpEvent } from '../../events/power-up.events.types.ts'
import {
  allocateAttachmentSlot,
  EMPTY_ATTACHMENT_SLOTS,
  freeAttachmentSlot,
} from '../../types/attachment-slots/attachment-slots.ts'
import {
  EffectState,
  getPowerUpEffectCategory,
  POWER_UP_EFFECT_ATTACHMENT_COUNTS,
  POWER_UP_EFFECT_POOL_SIZES,
  PowerUpEffectKind,
} from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type {
  EffectState as EffectStateValue,
  PowerUpEffect,
  PowerUpEffectKind as PowerUpEffectKindValue,
  PowerUpEffects,
} from '../../types/power-ups.types.ts'
import { releaseEffectEmitter } from '../effect-emitters/effect-emitters.ts'
import { getEffect, getStepWithEffect, getStepWithEvents } from '../power-up-step/power-up-step.ts'
import type { PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import type {
  EffectTakeRequest,
  EffectTakeResult,
  StealCandidate,
  AttachmentSlotAllocation,
} from './power-up-effects.types.ts'

// The order 0x004590f0 links the pools in.
const POOL_ORDER: readonly PowerUpEffectKindValue[] = Object.freeze([
  PowerUpEffectKind.MAGNET,
  PowerUpEffectKind.OIL_SLICK,
  PowerUpEffectKind.BARREL,
  PowerUpEffectKind.CURSE,
  PowerUpEffectKind.CANNON,
  PowerUpEffectKind.GRAPPLE,
  PowerUpEffectKind.WAND,
  PowerUpEffectKind.ROCKET,
  PowerUpEffectKind.SHIELD,
  PowerUpEffectKind.TURBO,
  PowerUpEffectKind.WARP,
])

// The original's state numbers; 0x0045b2e0 compares them as signed integers.
const STATE_NUMBERS: Readonly<Record<EffectStateValue, number>> = Object.freeze({
  [EffectState.IDLE]: 1,
  [EffectState.STARTING]: 2,
  [EffectState.ACTIVE]: 3,
  [EffectState.ENDING]: 4,
  [EffectState.FINAL_STAGE]: 5,
  [EffectState.FINISHED]: 6,
})

export const getEffectStateNumber = (state: EffectStateValue): number => STATE_NUMBERS[state]

const createIdleEffect = (id: number, kind: PowerUpEffectKindValue): PowerUpEffect =>
  Object.freeze({
    id,
    kind,
    state: EffectState.IDLE,
    timerMilliseconds: 0,
    level: 0,
    ownerRacer: null,
    targetRacer: null,
    targetTrackPoint: null,
    attachmentSlotIndices: Object.freeze([]),
    rocketIndex: 0,
    jitterMilliseconds: 0,
    sparkMilliseconds: 0,
    heldMilliseconds: 0,
    emitterHandleIndex: null,
  })

// 0x00457cf0 → 0x00457d30 (pool sizes) and 0x004590f0 (free lists, first object at the head).
export const createPowerUpEffects = (isSplitScreen: boolean): PowerUpEffects => {
  const kinds = POOL_ORDER.flatMap((kind) =>
    Array.from({ length: POWER_UP_EFFECT_POOL_SIZES[kind][isSplitScreen ? 0 : 1] }, () => kind)
  )
  const effects = Object.freeze(kinds.map((kind, id) => createIdleEffect(id, kind)))
  const freeEffectIds = Object.fromEntries(
    POOL_ORDER.map((kind) => [
      kind,
      Object.freeze(effects.filter((effect) => effect.kind === kind).map((effect) => effect.id)),
    ])
  ) as Record<PowerUpEffectKindValue, readonly number[]>
  return Object.freeze({
    effects,
    activeEffectIds: Object.freeze([]),
    freeEffectIds: Object.freeze(freeEffectIds),
    attachmentSlots: EMPTY_ATTACHMENT_SLOTS,
  })
}

const getStepWithEffects = (step: PowerUpStep, effects: PowerUpEffects): PowerUpStep =>
  Object.freeze({
    ...step,
    world: Object.freeze({ ...step.world, effects: Object.freeze(effects) }),
  })

// The classes whose reset lets their emitter vanish at once (0x00489f00); the others let the particles finish
// (0x00489f30).
const IMMEDIATE_EMITTER_RELEASE_KINDS: readonly PowerUpEffectKindValue[] = Object.freeze([
  PowerUpEffectKind.CANNON,
  PowerUpEffectKind.GRAPPLE,
  PowerUpEffectKind.TURBO,
])

// The racer-side calls each class's reset (vtable slot 7) makes.
const getResetEvents = (effect: PowerUpEffect): readonly PowerUpEvent[] => {
  if (effect.kind === PowerUpEffectKind.TURBO && effect.ownerRacer !== null) {
    return [{ type: 'power_ups.racer_turbo_ended', racer: effect.ownerRacer }]
  }
  if (effect.kind === PowerUpEffectKind.WAND && effect.targetRacer !== null) {
    return [{ type: 'power_ups.racer_released_by_lightning', racer: effect.targetRacer }]
  }
  if (effect.kind === PowerUpEffectKind.MAGNET && effect.targetRacer !== null) {
    return [{ type: 'power_ups.racer_released_by_magnet', racer: effect.targetRacer }]
  }
  return []
}

// Vtable slot 7 (0x00451ad0, 0x00452970, 0x00452f90, 0x00453e90, 0x00454d10, 0x00455a90, 0x004568a0, 0x00457250, 0x0045c060, 0x0045d360).
export const resetPowerUpEffect = (
  stepBeforeRelease: PowerUpStep,
  effectId: number
): PowerUpStep => {
  const step = releaseEffectEmitter(
    stepBeforeRelease,
    effectId,
    IMMEDIATE_EMITTER_RELEASE_KINDS.includes(getEffect(stepBeforeRelease, effectId).kind)
  )
  const effect = getEffect(step, effectId)
  const attachmentSlots = effect.attachmentSlotIndices.reduce(
    freeAttachmentSlot,
    step.world.effects.attachmentSlots
  )
  const withSlots = getStepWithEffects(
    step,
    Object.freeze({ ...step.world.effects, attachmentSlots })
  )
  return getStepWithEvents(
    getStepWithEffect(withSlots, {
      ...effect,
      state: EffectState.IDLE,
      timerMilliseconds: effect.kind === PowerUpEffectKind.ROCKET ? 0 : effect.timerMilliseconds,
      ownerRacer: null,
      targetRacer: null,
      targetTrackPoint: null,
      attachmentSlotIndices: Object.freeze([]),
      emitterHandleIndex: null,
    }),
    getResetEvents(effect)
  )
}

export class NoPowerUpEffectToTakeError extends Error {
  constructor(kind: PowerUpEffectKindValue) {
    super(`No free or stealable ${kind} effect; the original dereferences null here (0x0045b36d)`)
    this.name = 'NoPowerUpEffectToTakeError'
  }
}

// 0x0045b2e0: the matching active effect furthest along (highest state, then least time left) is reused.
const getStolenEffectId = (step: PowerUpStep, request: EffectTakeRequest): number => {
  const category = getPowerUpEffectCategory(request.kind)
  const best = step.world.effects.activeEffectIds.reduce<StealCandidate>(
    (current, effectId) => {
      const effect = getEffect(step, effectId)
      if (getPowerUpEffectCategory(effect.kind) !== category) return current
      if (!request.levels.includes(effect.level)) return current
      const state = getEffectStateNumber(effect.state)
      const isBetter =
        state > current.state ||
        (state === current.state && effect.timerMilliseconds < current.timer)
      return isBetter ? { effectId, state, timer: effect.timerMilliseconds } : current
    },
    { effectId: null, state: 0, timer: 0xffffffff }
  )
  if (best.effectId === null) throw new NoPowerUpEffectToTakeError(request.kind)
  return best.effectId
}

// The head of the class's free list, else a stolen active one; either way it becomes the active list's head.
export const takePowerUpEffect = (
  step: PowerUpStep,
  request: EffectTakeRequest
): EffectTakeResult => {
  const freeIds = step.world.effects.freeEffectIds[request.kind]
  const freeId = freeIds[0]
  if (freeId !== undefined) {
    const effects = step.world.effects
    return Object.freeze({
      step: getStepWithEffects(step, {
        ...effects,
        freeEffectIds: Object.freeze({
          ...effects.freeEffectIds,
          [request.kind]: freeIds.slice(1),
        }),
        activeEffectIds: Object.freeze([freeId, ...effects.activeEffectIds]),
      }),
      effectId: freeId,
    })
  }
  const effectId = getStolenEffectId(step, request)
  const reset = resetPowerUpEffect(step, effectId)
  const effects = reset.world.effects
  const activeEffectIds = effects.activeEffectIds.filter((activeId) => activeId !== effectId)
  return Object.freeze({
    step: getStepWithEffects(reset, {
      ...effects,
      activeEffectIds: Object.freeze([effectId, ...activeEffectIds]),
    }),
    effectId,
  })
}

// 0x0045b9e0 for an object other than an effect (the brick debris): the lowest free slot, or null.
export const getStepWithAttachmentSlot = (step: PowerUpStep): AttachmentSlotAllocation => {
  const allocation = allocateAttachmentSlot(step.world.effects.attachmentSlots)
  return Object.freeze({
    step: getStepWithEffects(step, { ...step.world.effects, attachmentSlots: allocation.slots }),
    slotIndex: allocation.slotIndex,
  })
}

// 0x0045ba40 for an object other than an effect.
export const getStepWithAttachmentSlotFreed = (step: PowerUpStep, slotIndex: number): PowerUpStep =>
  getStepWithEffects(step, {
    ...step.world.effects,
    attachmentSlots: freeAttachmentSlot(step.world.effects.attachmentSlots, slotIndex),
  })

// 0x0045b9e0 for each attachment the class needs; on a failure the effect finishes at once (state 6).
export const getStepWithAttachments = (step: PowerUpStep, effectId: number): PowerUpStep => {
  const effect = getEffect(step, effectId)
  const required = POWER_UP_EFFECT_ATTACHMENT_COUNTS[effect.kind]
  let slots = step.world.effects.attachmentSlots
  const slotIndices: number[] = []
  let isFailed = false
  while (slotIndices.length < required && !isFailed) {
    const allocation = allocateAttachmentSlot(slots)
    slots = allocation.slots
    if (allocation.slotIndex === null) isFailed = true
    else slotIndices.push(allocation.slotIndex)
  }
  const withSlots = getStepWithEffects(step, { ...step.world.effects, attachmentSlots: slots })
  return getStepWithEffect(withSlots, {
    ...effect,
    attachmentSlotIndices: Object.freeze(slotIndices),
    state: isFailed ? EffectState.FINISHED : effect.state,
  })
}

// The tail of PowerUps_Update 0x0045a490: finished effects leave the active list, are reset and pushed on their free list.
export const recyclePowerUpEffects = (step: PowerUpStep): PowerUpStep =>
  step.world.effects.activeEffectIds.reduce((current, effectId) => {
    if (getEffect(current, effectId).state !== EffectState.FINISHED) return current
    const reset = resetPowerUpEffect(current, effectId)
    const effects = reset.world.effects
    const kind = getEffect(reset, effectId).kind
    return getStepWithEffects(reset, {
      ...effects,
      activeEffectIds: Object.freeze(effects.activeEffectIds.filter((id) => id !== effectId)),
      freeEffectIds: Object.freeze({
        ...effects.freeEffectIds,
        [kind]: Object.freeze([effectId, ...effects.freeEffectIds[kind]]),
      }),
    })
  }, step)

// Effects of one class whose state is above 1 and that belong to the racer finish (0x0045b640, 0x0045b690, 0x0045b6f0).
export const getStepWithRacerEffectsFinished = (
  step: PowerUpStep,
  kind: PowerUpEffectKindValue,
  racer: number,
  getRacerOf: (effect: PowerUpEffect) => number | null,
  isOwnerCleared: boolean
): PowerUpStep =>
  step.world.effects.effects.reduce((current, effect) => {
    if (effect.kind !== kind || getEffectStateNumber(effect.state) <= 1) return current
    if (getRacerOf(effect) !== racer) return current
    return getStepWithEffect(current, {
      ...effect,
      state: EffectState.FINISHED,
      ownerRacer: isOwnerCleared ? null : effect.ownerRacer,
    })
  }, step)

// 0x0045b740 (thiscall: racer), the effects of a finishing racer: a warp of the racer that is still starting is
// finished at once, and one that is running has its time set to 0, so it ends at the next update.
export const getStepWithRacerWarpsFinished = (step: PowerUpStep, racer: number): PowerUpStep =>
  step.world.effects.effects.reduce((current, effect) => {
    if (effect.kind !== PowerUpEffectKind.WARP || effect.ownerRacer !== racer) return current
    if (effect.state === EffectState.STARTING) {
      return getStepWithEffect(current, { ...effect, state: EffectState.FINISHED })
    }
    return effect.state === EffectState.ACTIVE
      ? getStepWithEffect(current, { ...effect, timerMilliseconds: 0 })
      : current
  }, step)

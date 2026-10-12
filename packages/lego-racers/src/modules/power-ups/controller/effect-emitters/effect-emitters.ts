import {
  getEmitterBornCount,
  getHasEmitterDefinition,
  getIsEmitterHandleLive,
  releaseEmitter,
  releaseEmitterImmediately,
  setEmitterBasis,
  setEmitterPosition,
  setEmitterVelocityOffset,
  spawnEmitter,
} from '../../../emitter/index.ts'
import type { EmitterPool } from '../../../emitter/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { EffectEmitterOwner } from './effect-emitters.types.ts'
import { getEffect, getStepWithEffect } from '../power-up-step/power-up-step.ts'
import type { PowerUpStep } from '../power-up-step/power-up-step.types.ts'

// 0x00451b50, 0x00453ef0: an effect lets go of its smoke once the emitter has born more than 2 particles.
const EFFECT_EMITTER_MAXIMUM_BORN_COUNT = 2

const getStepWithPool = (step: PowerUpStep, pool: EmitterPool): PowerUpStep =>
  Object.freeze({
    ...step,
    world: Object.freeze({
      ...step.world,
      emitters: Object.freeze({ ...step.world.emitters, common: pool }),
    }),
  })

// 0x00489d70 for an effect: the handle it returns (null for none free, no such emitter or a one-shot) replaces the
// effect's field whatever it was.
export const startEffectEmitter = (
  step: PowerUpStep,
  arithmetic: FloatArithmetic,
  effectId: number,
  name: string
): PowerUpStep => {
  const { common } = step.world.emitters
  const effect = getEffect(step, effectId)
  if (common === null || !getHasEmitterDefinition(common, name)) {
    return getStepWithEffect(step, { ...effect, emitterHandleIndex: null })
  }
  const spawn = spawnEmitter(arithmetic, common, name, { position: null, orientation: null })
  return getStepWithEffect(getStepWithPool(step, spawn.pool), {
    ...effect,
    emitterHandleIndex: spawn.handleIndex,
  })
}

// 0x00489f30 (the particles alive finish their lives) or 0x00489f00 (they vanish) on the effect's handle.
export const releaseEffectEmitter = (
  step: PowerUpStep,
  effectId: number,
  isImmediate: boolean
): PowerUpStep => {
  const effect = getEffect(step, effectId)
  const { common } = step.world.emitters
  if (effect.emitterHandleIndex === null) return step
  const released =
    common === null
      ? step
      : getStepWithPool(
          step,
          isImmediate
            ? releaseEmitterImmediately(common, effect.emitterHandleIndex)
            : releaseEmitter(common, effect.emitterHandleIndex)
        )
  return getStepWithEffect(released, { ...getEffect(released, effectId), emitterHandleIndex: null })
}

// 0x004b13b0 and 0x004b1504: the smoke sits 4 above the owner's frame.
const EFFECT_EMITTER_HEIGHT = 4

// The tail of 0x00451b50 and 0x00453ef0: the smoke goes once its emitter was taken over or has born enough particles;
// else it follows the owner: its basis is the frame's rotation (slot +0x44), its position the frame's 4 higher (0x00489660)
// and its velocity offset the car body's velocity (0x00489690). **Hypothesis:** the frame at racer +0x524 is the display
// frame.
export const checkEffectEmitter = (
  step: PowerUpStep,
  effectId: number,
  arithmetic: FloatArithmetic,
  owner: EffectEmitterOwner | null
): PowerUpStep => {
  const { emitterHandleIndex } = getEffect(step, effectId)
  const { common } = step.world.emitters
  if (emitterHandleIndex === null || common === null) return step
  const bornCount = getEmitterBornCount(common, emitterHandleIndex)
  const isFinished =
    !getIsEmitterHandleLive(common, emitterHandleIndex) ||
    (bornCount ?? 0) > EFFECT_EMITTER_MAXIMUM_BORN_COUNT
  if (isFinished) return releaseEffectEmitter(step, effectId, false)
  if (owner === null) return step
  const based = setEmitterBasis(common, emitterHandleIndex, owner.rotation)
  const placed = setEmitterPosition(based, emitterHandleIndex, {
    x: owner.position.x,
    y: owner.position.y,
    z: arithmetic.storeFloat(arithmetic.add(EFFECT_EMITTER_HEIGHT, owner.position.z)),
  })
  return getStepWithPool(
    step,
    setEmitterVelocityOffset(arithmetic, placed, emitterHandleIndex, owner.velocity)
  )
}

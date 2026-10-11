import {
  getEmitterBornCount,
  getHasEmitterDefinition,
  getIsEmitterHandleLive,
  releaseEmitter,
  releaseEmitterImmediately,
  spawnEmitter,
} from '../../../emitter/index.ts'
import type { EmitterPool } from '../../../emitter/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
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

// 0x00489d70 on the common pool for something that keeps no handle (the explosion's "explode"): the emitter starts
// at the position, a pool without such an emitter does nothing.
export const startStepEmitter = (
  step: PowerUpStep,
  arithmetic: FloatArithmetic,
  name: string,
  position: Vector3 | null
): PowerUpStep => {
  const { common } = step.world.emitters
  if (common === null || !getHasEmitterDefinition(common, name)) return step
  const spawn = spawnEmitter(arithmetic, common, name, { position, orientation: null })
  return getStepWithPool(step, spawn.pool)
}

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

// The tail of 0x00451b50 and 0x00453ef0: the smoke goes once its emitter was taken over or has born enough particles.
export const checkEffectEmitter = (step: PowerUpStep, effectId: number): PowerUpStep => {
  const { emitterHandleIndex } = getEffect(step, effectId)
  const { common } = step.world.emitters
  if (emitterHandleIndex === null || common === null) return step
  const bornCount = getEmitterBornCount(common, emitterHandleIndex)
  const isFinished =
    !getIsEmitterHandleLive(common, emitterHandleIndex) ||
    (bornCount ?? 0) > EFFECT_EMITTER_MAXIMUM_BORN_COUNT
  return isFinished ? releaseEffectEmitter(step, effectId, false) : step
}

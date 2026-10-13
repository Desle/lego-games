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
import { getFrameTransformedPoint } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
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

// 0x00489660 on the effect's emitter: where its particles are born (the oil slick's bubbles, at the ground point it
// lands on, 0x004573a0).
export const placeEffectEmitter = (
  step: PowerUpStep,
  effectId: number,
  position: Vector3
): PowerUpStep => {
  const { emitterHandleIndex } = getEffect(step, effectId)
  const { common } = step.world.emitters
  return emitterHandleIndex === null || common === null
    ? step
    : getStepWithPool(step, setEmitterPosition(common, emitterHandleIndex, position))
}

// 0x0045ce20 (turbo slot 2): the level 2 turbo's smoke sits at (-2, 0, 3) of the owner's frame, takes its rotation as
// basis and 0.7 of its car body's velocity as the velocity offset.
// float32 -2.0 and 3.0 pushed at 0x0045ceac and 0x0045cebc
const TURBO_SMOKE_LOCAL_POINT: Vector3 = Object.freeze({ x: -2, y: 0, z: 3 })
const TURBO_SMOKE_VELOCITY_FACTOR = Math.fround(0.7) // float32 0.7 at 0x004b19e4
export const placeTurboSmoke = (
  step: PowerUpStep,
  effectId: number,
  arithmetic: FloatArithmetic,
  owner: EffectEmitterOwner | null
): PowerUpStep => {
  const { emitterHandleIndex } = getEffect(step, effectId)
  const { common } = step.world.emitters
  if (emitterHandleIndex === null || common === null || owner === null) return step
  const { multiply, storeFloat } = arithmetic
  const based = setEmitterBasis(common, emitterHandleIndex, owner.rotation)
  const placed = setEmitterPosition(
    based,
    emitterHandleIndex,
    getFrameTransformedPoint(
      arithmetic,
      { rotation: owner.rotation, position: owner.position },
      TURBO_SMOKE_LOCAL_POINT
    )
  )
  return getStepWithPool(
    step,
    setEmitterVelocityOffset(arithmetic, placed, emitterHandleIndex, {
      x: storeFloat(multiply(TURBO_SMOKE_VELOCITY_FACTOR, owner.velocity.x)),
      y: storeFloat(multiply(TURBO_SMOKE_VELOCITY_FACTOR, owner.velocity.y)),
      z: storeFloat(multiply(TURBO_SMOKE_VELOCITY_FACTOR, owner.velocity.z)),
    })
  )
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

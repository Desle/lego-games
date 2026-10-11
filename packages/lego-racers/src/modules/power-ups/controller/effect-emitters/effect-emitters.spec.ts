import { createEmitterPool } from '../../../emitter/index.ts'
import type { Emitter } from '../../../emitter/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { createPowerUpWorld } from '../power-up-world/power-up-world.ts'
import { getEffect } from '../power-up-step/power-up-step.ts'
import type { PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import {
  checkEffectEmitter,
  releaseEffectEmitter,
  startEffectEmitter,
  startStepEmitter,
} from './effect-emitters.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const createEmitter = (name: string, lifetime: number): Emitter => ({
  name,
  firstTruncatedValue: 100,
  secondTruncatedValue: 0,
  vector: [0, 0, 0],
  points: [[0, 0, 1]],
  firstFloat: 1,
  secondFloat: 1,
  thirdFloat: 0,
  fourthFloat: 0,
  fifthFloat: 10,
  entryIndex: null,
  firstInteger: 500,
  secondInteger: lifetime,
  thirdInteger: 1,
  linkedName: null,
})

const createStep = (): PowerUpStep => {
  const step = createPowerUpWorld({
    bricks: [],
    enhancementBricks: [],
    raceModeFlags: 0,
    isSplitScreen: true,
    racers: [{ voiceSoundBase: 0, voiceCooldownMilliseconds: 0 }],
    random: { table: createRandomTable(Array.from({ length: 1024 }, () => 0)), position: 0 },
  })
  return {
    ...step,
    world: {
      ...step.world,
      emitters: {
        common: createEmitterPool({
          list: {
            emitters: [createEmitter('cannsmk', -1), createEmitter('explode', 1000)],
            readByteCount: 0,
          },
          instanceCount: 3,
          animation: null,
        }),
        track: null,
      },
    },
  }
}

describe('startEffectEmitter', () => {
  it('keeps the handle of an emitter without a lifetime', () => {
    // Arrange
    const step = createStep()

    // Act
    const started = startEffectEmitter(step, SINGLE, 0, 'cannsmk')

    // Assert
    expect(getEffect(started, 0).emitterHandleIndex).toBe(0)
    expect(started.world.emitters.common?.handles[0]?.isTaken).toBe(true)
  })

  it('keeps no handle when the pool has no such emitter', () => {
    // Arrange
    const step = createStep()

    // Act
    const started = startEffectEmitter(step, SINGLE, 0, 'missing')

    // Assert
    expect(getEffect(started, 0).emitterHandleIndex).toBeNull()
  })

  it('keeps no handle for a one-shot emitter', () => {
    // Arrange
    const step = createStep()

    // Act
    const started = startEffectEmitter(step, SINGLE, 0, 'explode')

    // Assert
    expect(getEffect(started, 0).emitterHandleIndex).toBeNull()
  })
})

describe('startStepEmitter', () => {
  it('starts an emitter in the common pool without any handle', () => {
    // Arrange
    const step = createStep()

    // Act
    const started = startStepEmitter(step, SINGLE, 'explode', { x: 1, y: 2, z: 3 })

    // Assert
    const instances = started.world.emitters.common?.instances ?? []
    expect(instances.some((instance) => instance.system.isActive)).toBe(true)
  })
})

describe('releaseEffectEmitter', () => {
  it('frees the handle and forgets it', () => {
    // Arrange
    const started = startEffectEmitter(createStep(), SINGLE, 0, 'cannsmk')

    // Act
    const released = releaseEffectEmitter(started, 0, true)

    // Assert
    expect(getEffect(released, 0).emitterHandleIndex).toBeNull()
    expect(released.world.emitters.common?.handles[0]?.isTaken).toBe(false)
  })
})

describe('checkEffectEmitter', () => {
  it('keeps an emitter that has born few particles', () => {
    // Arrange
    const started = startEffectEmitter(createStep(), SINGLE, 0, 'cannsmk')

    // Act
    const checked = checkEffectEmitter(started, 0)

    // Assert
    expect(getEffect(checked, 0).emitterHandleIndex).toBe(0)
  })
})

import { NO_EMITTER_POOLS } from '../../../emitter/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import {
  EffectState,
  PowerUpEffectKind,
} from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type { PowerUpEffect } from '../../types/power-ups.types.ts'
import { getEffect, getStepWithEffect } from '../power-up-step/power-up-step.ts'
import type { PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import {
  createPowerUpEffects,
  NoPowerUpEffectToTakeError,
  recyclePowerUpEffects,
  takePowerUpEffect,
} from './power-up-effects.ts'

const createStep = (isSplitScreen: boolean): PowerUpStep =>
  Object.freeze({
    world: Object.freeze({
      bricks: [],
      enhancementBricks: [],
      racers: [],
      effects: createPowerUpEffects(isSplitScreen),
      brickSpinAngle: 0,
      emitters: NO_EMITTER_POOLS,
      random: { table: createRandomTable(Array.from({ length: 1024 }, () => 0)), position: 0 },
    }),
    events: [],
  })

const getKindCount = (step: PowerUpStep, kind: PowerUpEffect['kind']): number =>
  step.world.effects.effects.filter((effect) => effect.kind === kind).length

describe('createPowerUpEffects', () => {
  it('builds the one-screen pools of 0x00457d30', () => {
    // Arrange
    const isSplitScreen = false

    // Act
    const step = createStep(isSplitScreen)

    // Assert
    expect(step.world.effects.effects).toHaveLength(45)
    expect(getKindCount(step, PowerUpEffectKind.ROCKET)).toBe(9)
    expect(getKindCount(step, PowerUpEffectKind.SHIELD)).toBe(5)
    expect(step.world.effects.freeEffectIds[PowerUpEffectKind.MAGNET]).toEqual([0, 1, 2])
  })

  it('builds the smaller split-screen pools', () => {
    // Arrange
    const isSplitScreen = true

    // Act
    const step = createStep(isSplitScreen)

    // Assert
    expect(step.world.effects.effects).toHaveLength(27)
    expect(getKindCount(step, PowerUpEffectKind.ROCKET)).toBe(6)
  })
})

describe('takePowerUpEffect', () => {
  it('takes the free list head and makes it the active list head', () => {
    // Arrange
    const step = createStep(true)

    // Act
    const first = takePowerUpEffect(step, { kind: PowerUpEffectKind.CURSE, levels: [3] })
    const second = takePowerUpEffect(first.step, { kind: PowerUpEffectKind.CURSE, levels: [3] })

    // Assert
    expect(first.effectId).toBe(7)
    expect(second.step.world.effects.activeEffectIds).toEqual([8, 7])
    expect(second.step.world.effects.freeEffectIds[PowerUpEffectKind.CURSE]).toEqual([])
  })

  it('steals the matching effect with the highest state, then the least time left (0x0045b2e0)', () => {
    // Arrange
    const taken = [0, 1].reduce(
      (current) => takePowerUpEffect(current, { kind: PowerUpEffectKind.CURSE, levels: [3] }).step,
      createStep(true)
    )
    const withStates = [
      { id: 7, state: EffectState.ACTIVE, timerMilliseconds: 900 },
      { id: 8, state: EffectState.ACTIVE, timerMilliseconds: 300 },
    ].reduce(
      (current, change) =>
        getStepWithEffect(current, { ...getEffect(current, change.id), ...change, level: 3 }),
      taken
    )

    // Act
    const stolen = takePowerUpEffect(withStates, { kind: PowerUpEffectKind.CURSE, levels: [3] })

    // Assert
    expect(stolen.effectId).toBe(8)
    expect(getEffect(stolen.step, 8).state).toBe(EffectState.IDLE)
    expect(stolen.step.world.effects.activeEffectIds).toEqual([8, 7])
  })

  it('fails where the original dereferences null: nothing free and nothing to steal', () => {
    // Arrange
    const empty = takePowerUpEffect(
      takePowerUpEffect(createStep(true), { kind: PowerUpEffectKind.CURSE, levels: [3] }).step,
      { kind: PowerUpEffectKind.CURSE, levels: [3] }
    ).step

    // Act
    const take = () => takePowerUpEffect(empty, { kind: PowerUpEffectKind.CURSE, levels: [2] })

    // Assert
    expect(take).toThrow(NoPowerUpEffectToTakeError)
  })
})

describe('recyclePowerUpEffects', () => {
  it('returns finished effects to the head of their free list (0x0045a490)', () => {
    // Arrange
    const taken = takePowerUpEffect(createStep(true), {
      kind: PowerUpEffectKind.OIL_SLICK,
      levels: [0],
    })
    const finished = getStepWithEffect(taken.step, {
      ...getEffect(taken.step, taken.effectId),
      state: EffectState.FINISHED,
    })

    // Act
    const recycled = recyclePowerUpEffects(finished)

    // Assert
    expect(recycled.world.effects.activeEffectIds).toEqual([])
    expect(recycled.world.effects.freeEffectIds[PowerUpEffectKind.OIL_SLICK]).toEqual([2, 3, 4])
    expect(getEffect(recycled, 2).state).toBe(EffectState.IDLE)
  })
})

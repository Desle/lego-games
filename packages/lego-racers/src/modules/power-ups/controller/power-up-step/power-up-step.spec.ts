import { NO_EMITTER_POOLS } from '../../../emitter/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import type { PowerUpStep } from './power-up-step.types.ts'
import {
  getStepDraws,
  getStepWithShieldStruck,
  UnknownIndexError,
  getEffect,
} from './power-up-step.ts'

// Table value = index.
const createStep = (position: number): PowerUpStep =>
  Object.freeze({
    world: Object.freeze({
      bricks: [],
      enhancementBricks: [],
      racers: [],
      effects: {
        effects: [],
        activeEffectIds: [],
        freeEffectIds: {
          cannon: [],
          grapple: [],
          wand: [],
          rocket: [],
          oil_slick: [],
          barrel: [],
          magnet: [],
          curse: [],
          shield: [],
          turbo: [],
          warp: [],
        },
        attachmentSlots: { usedMask: 0, usedCount: 0 },
      },
      brickSpinAngle: 0,
      brickClockMilliseconds: 0,
      emitters: NO_EMITTER_POOLS,
      random: {
        table: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
        position,
      },
    }),
    events: [],
  })

describe('getStepDraws', () => {
  it('advances the position before each read and wraps at 1024', () => {
    // Arrange
    const step = createStep(1022)

    // Act
    const draws = getStepDraws(step, 3)

    // Assert
    expect(draws.values).toEqual([1023, 0, 1])
    expect(draws.step.world.random.position).toBe(1)
  })
})

describe('getStepWithShieldStruck', () => {
  it('plays sound 1, 0x46 or 0x47 by table % 3 (0x0043a270)', () => {
    // Arrange
    const positions = [2, 3, 4]

    // Act
    const sounds = positions.map(
      (position) => getStepWithShieldStruck(createStep(position), 0).events[0]
    )

    // Assert
    expect(sounds).toEqual([
      { type: 'power_ups.racer_shield_struck', racer: 0, sound: 1 },
      { type: 'power_ups.racer_shield_struck', racer: 0, sound: 0x46 },
      { type: 'power_ups.racer_shield_struck', racer: 0, sound: 0x47 },
    ])
  })
})

describe('getEffect', () => {
  it('rejects an unknown effect', () => {
    // Arrange
    const step = createStep(0)

    // Act
    const get = () => getEffect(step, 3)

    // Assert
    expect(get).toThrow(UnknownIndexError)
  })
})

import {
  createTestCarBodyWith,
  createTestContext,
} from '../../types/racer-fixtures/racer-fixtures.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import {
  COPIED_FIGURE_DISTANCE,
  POWER_UP_EFFECT_FIGURE_DISTANCE,
} from '../../types/colour-shift-override/colour-shift-override.ts'
import { getRacerWithTimedEffect, transferTimedEffect } from './timed-effect.ts'

const createRacers = () => [
  createRacer(createTestCarBodyWith({})),
  createRacer(createTestCarBodyWith({})),
]

describe('the timed effect hand-over, 0x00439900', () => {
  it('tints the first holder for as long as the effect figure distance says, and stores 0 in its copy', () => {
    // Arrange
    const context = createTestContext()
    const [receiver] = createRacers()

    // Act
    const holder = getRacerWithTimedEffect(
      context.arithmetic,
      receiver!,
      10000,
      POWER_UP_EFFECT_FIGURE_DISTANCE
    )

    // Assert
    expect(holder.colourShiftOverrideMilliseconds).toBe(POWER_UP_EFFECT_FIGURE_DISTANCE)
    expect(holder.timedEffectFigureDistance).toBe(COPIED_FIGURE_DISTANCE)
    expect(holder.timedEffectMilliseconds).toBe(10000)
  })

  it('passes 0 milliseconds of tint on to the next racer', () => {
    // Arrange
    const context = createTestContext()
    const [first, second] = createRacers()
    const holder = getRacerWithTimedEffect(
      context.arithmetic,
      first!,
      10000,
      POWER_UP_EFFECT_FIGURE_DISTANCE
    )

    // Act
    const racerSet = transferTimedEffect(context, createRacerSet([holder, second!], 0, 0), 1, 0)

    // Assert
    expect(getRacer(racerSet, 1).colourShiftOverrideMilliseconds).toBe(0)
    expect(getRacer(racerSet, 1).isColourShiftOverridden).toBe(true)
    expect(getRacer(racerSet, 1).timedEffectMilliseconds).toBe(10000)
  })
})

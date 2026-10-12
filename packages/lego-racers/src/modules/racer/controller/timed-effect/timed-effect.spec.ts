import {
  createTestCarBodyWith,
  createTestContext,
} from '../../types/racer-fixtures/racer-fixtures.ts'
import { IDENTITY_MATRIX3 } from '../../../simulation-math/index.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import {
  DEFAULT_FIGURE_FRAME,
  getRacerWithoutTimedEffect,
  getRacerWithTimedEffect,
  transferTimedEffect,
} from './timed-effect.ts'

const createRacers = () => [
  createRacer(createTestCarBodyWith({})),
  createRacer(createTestCarBodyWith({})),
]

describe('the timed effect hand-over, 0x00439900', () => {
  it('tints the holder for as long as the effect lasts (0x00440100 gets the same milliseconds)', () => {
    // Arrange
    const context = createTestContext()
    const [receiver] = createRacers()

    // Act
    const holder = getRacerWithTimedEffect(
      context.arithmetic,
      receiver!,
      10000,
      DEFAULT_FIGURE_FRAME
    )

    // Assert
    expect(holder.colourShiftOverrideMilliseconds).toBe(10000)
    expect(holder.timedEffectMilliseconds).toBe(10000)
  })

  it('passes the milliseconds left on to the next racer, tint and effect alike', () => {
    // Arrange
    const context = createTestContext()
    const [first, second] = createRacers()
    const holder = getRacerWithTimedEffect(context.arithmetic, first!, 10000, DEFAULT_FIGURE_FRAME)

    // Act
    const racerSet = transferTimedEffect(context, createRacerSet([holder, second!], 0, 0), 1, 0)

    // Assert
    expect(getRacer(racerSet, 1).colourShiftOverrideMilliseconds).toBe(10000)
    expect(getRacer(racerSet, 1).isColourShiftOverridden).toBe(true)
    expect(getRacer(racerSet, 1).timedEffectMilliseconds).toBe(10000)
  })

  it('binds the curse figure at the frame it is given, at full size', () => {
    // Arrange
    const context = createTestContext()
    const [receiver] = createRacers()
    const frame = { position: { x: 4, y: 5, z: 6 }, rotation: IDENTITY_MATRIX3 }

    // Act
    const holder = getRacerWithTimedEffect(context.arithmetic, receiver!, 10000, frame)

    // Assert
    expect(holder.vehicle.curseOrbit.figure).toEqual({
      ...frame,
      scale: 1,
      animationMilliseconds: 0,
    })
  })

  it("hands the giver's figure frame on to the next racer", () => {
    // Arrange
    const context = createTestContext()
    const [first, second] = createRacers()
    const frame = { position: { x: 7, y: 8, z: 9 }, rotation: IDENTITY_MATRIX3 }
    const holder = getRacerWithTimedEffect(context.arithmetic, first!, 10000, frame)

    // Act
    const racerSet = transferTimedEffect(context, createRacerSet([holder, second!], 0, 0), 1, 0)

    // Assert
    expect(getRacer(racerSet, 1).vehicle.curseOrbit.figure?.position).toEqual(frame.position)
  })

  it('lets the curse figure go when the effect ends (0x00439b00)', () => {
    // Arrange
    const context = createTestContext()
    const [receiver] = createRacers()
    const holder = getRacerWithTimedEffect(
      context.arithmetic,
      receiver!,
      10000,
      DEFAULT_FIGURE_FRAME
    )

    // Act
    const ended = getRacerWithoutTimedEffect(holder)

    // Assert
    expect(ended.vehicle.curseOrbit.figure).toBeNull()
  })
})

import { createTestCarBodyWith } from '../racer-fixtures/racer-fixtures.ts'
import { createRacer } from '../racer-state/racer-state.ts'
import type { ColourShift } from '../racer.types.ts'
import {
  clearColourShiftOverride,
  getDisplayedColourShift,
  getRacerWithColourShiftOverride,
  stepColourShiftOverride,
  WAND_COLOUR_SHIFT,
} from './colour-shift-override.ts'

const TRACK_SHIFT: ColourShift = { shifts: [1, 1, 1, 0], biases: [0, 0, 0, 0] }

const createTrackShiftedRacer = () => ({
  ...createRacer(createTestCarBodyWith({})),
  colourShift: TRACK_SHIFT,
})

describe('the colour shift override of 0x00440100', () => {
  it('shows its own shift instead of the track shift until it is cleared', () => {
    // Arrange
    const racer = createTrackShiftedRacer()

    // Act
    const overridden = getRacerWithColourShiftOverride(racer, WAND_COLOUR_SHIFT, 100)
    const cleared = clearColourShiftOverride(overridden)

    // Assert
    expect(getDisplayedColourShift(racer)).toBe(TRACK_SHIFT)
    expect(getDisplayedColourShift(overridden)).toBe(WAND_COLOUR_SHIFT)
    expect(getDisplayedColourShift(cleared)).toBe(TRACK_SHIFT)
    expect(cleared.colourShiftOverrideMilliseconds).toBe(0)
  })

  it('counts its milliseconds down and clears when a step reaches them (0x0043e070)', () => {
    // Arrange
    const overridden = getRacerWithColourShiftOverride(
      createTrackShiftedRacer(),
      WAND_COLOUR_SHIFT,
      100
    )

    // Act
    const counted = stepColourShiftOverride(overridden, 60)
    const reached = stepColourShiftOverride(counted, 40)

    // Assert
    expect(counted.colourShiftOverrideMilliseconds).toBe(40)
    expect(counted.isColourShiftOverridden).toBe(true)
    expect(reached.isColourShiftOverridden).toBe(false)
    expect(reached.colourShiftOverrideMilliseconds).toBe(0)
  })

  it('leaves a racer without an override as it is', () => {
    // Arrange
    const racer = createTrackShiftedRacer()

    // Act
    const stepped = stepColourShiftOverride(racer, 16)

    // Assert
    expect(stepped).toBe(racer)
  })

  it('clears at once when it was given no milliseconds', () => {
    // Arrange
    const overridden = getRacerWithColourShiftOverride(
      createTrackShiftedRacer(),
      WAND_COLOUR_SHIFT,
      0
    )

    // Act
    const stepped = stepColourShiftOverride(overridden, 0)

    // Assert
    expect(stepped.isColourShiftOverridden).toBe(false)
  })
})

import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  getComputerChance,
  getComputerPersonality,
  PERSONALITY_SCALE,
} from './computer-personality.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

describe('computer personality', () => {
  it('computes the static scale (1 - 0.2) * 100 / 90 in double precision', () => {
    // Arrange
    const expected = Math.fround((1 - Math.fround(0.2)) * 100 * Math.fround(1 / 90))

    // Act
    const scale = PERSONALITY_SCALE

    // Assert
    expect(scale).toBe(expected)
  })

  it('maps a byte of 0 to 20 % and caps at 100 % (255)', () => {
    // Arrange
    const bytes = [0, 90, 100]

    // Act
    const chances = bytes.map((byte) => getComputerChance(SINGLE, byte))

    // Assert
    expect(chances[0]).toBe(Math.trunc(Math.fround(Math.fround(0.2) * 255)))
    expect(chances[2]).toBe(255)
  })

  it('derives the combined chance from (d1d - d1f - d1e + d1c) * 0.001953125 * 30, 0 when negative', () => {
    // Arrange
    const balanced = [100, 100, 0, 0, 0, 0]
    const negative = [0, 0, 100, 100, 0, 0]

    // Act
    const personality = getComputerPersonality(SINGLE, balanced)
    const negativePersonality = getComputerPersonality(SINGLE, negative)

    // Assert
    const low = getComputerChance(SINGLE, 0)
    expect(personality.chances).toEqual([255, 255, low, low, low, low])
    expect(personality.combinedChance).toBe(Math.trunc((255 + 255 - 2 * low) * 0.001953125 * 30))
    expect(negativePersonality.combinedChance).toBe(0)
  })
})

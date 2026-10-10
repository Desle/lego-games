import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { getFloatToInteger } from '../float-to-integer/float-to-integer.ts'
import type { ComputerPersonality } from '../racer-ai.types.ts'

const MINIMUM_CHANCE = Math.fround(0.2) // 0x004b0984
const PERCENT = Math.fround(0.01) // 0x004af668
const CHANCE_SCALE = 255 // 0x004b09c0
const COMBINED_SCALE = 0.001953125 // 0x004b09bc
const COMBINED_FACTOR = 30 // 0x004b09b8
const LOW_BYTE_MASK = 0xff
export const PERSONALITY_BYTE_COUNT = 6

// 0x00436970, a static initializer run by the CRT's initterm after SetDefaultFpuPrecision (53-bit):
// (1.0 - 0.2) * 100 * (1 / 90), stored as float32 at 0x004c67a4.
const getPersonalityScale = (): number => {
  const { subtract, multiply, storeFloat } = createFloatArithmetic(FpuPrecision.DOUBLE)
  return storeFloat(multiply(multiply(subtract(1, MINIMUM_CHANCE), 100), Math.fround(1 / 90)))
}

export const PERSONALITY_SCALE = getPersonalityScale()

// 0x00436f08..0x004370a0: min(byte * scale * 0.01 + 0.2, 1.0) * 255, through _ftol, low byte kept.
export const getComputerChance = (arithmetic: FloatArithmetic, personalityByte: number): number => {
  const { add, multiply, getIsBelowOrEqual } = arithmetic
  const chance = add(
    multiply(multiply(personalityByte, PERSONALITY_SCALE), PERCENT),
    MINIMUM_CHANCE
  )
  const capped = getIsBelowOrEqual(chance, 1) ? chance : 1
  return getFloatToInteger(multiply(capped, CHANCE_SCALE)) & LOW_BYTE_MASK
}

// 0x00436df0's personality part: racer +0xd1c..+0xd21 from the driver's bytes (description +0x6c..+0x71),
// then +0xd22 from (d1d - d1f - d1e + d1c) * 0.001953125 * 30, or 0 when that sum is negative.
export const getComputerPersonality = (
  arithmetic: FloatArithmetic,
  personalityBytes: readonly number[]
): ComputerPersonality => {
  const chances = Array.from({ length: PERSONALITY_BYTE_COUNT }, (_, index) =>
    getComputerChance(arithmetic, personalityBytes[index] ?? 0)
  )
  const [chance0 = 0, chance1 = 0, chance2 = 0, chance3 = 0] = chances
  const sum = chance1 - chance3 - chance2 + chance0
  const combinedChance =
    sum < 0
      ? 0
      : getFloatToInteger(
          arithmetic.multiply(arithmetic.multiply(sum, COMBINED_SCALE), COMBINED_FACTOR)
        ) & LOW_BYTE_MASK
  return Object.freeze({ chances: Object.freeze(chances), combinedChance })
}

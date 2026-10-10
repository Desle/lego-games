import { getFloatFromBits } from './float-bits.ts'
import type { FloatSampler, SeededRandom } from './seeded-random.types.ts'

// mulberry32: small, fast and identical on every machine, so a failing case can be replayed from its seed.
export const createSeededRandom = (seed: number): SeededRandom => {
  let state = seed >>> 0
  const nextUnsignedInteger = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return (mixed ^ (mixed >>> 14)) >>> 0
  }
  return {
    nextUnsignedInteger,
    nextFraction: () => nextUnsignedInteger() / 0x100000000,
    nextIntegerBelow: (limit) => nextUnsignedInteger() % limit,
  }
}

const EDGE_BIT_PATTERNS: readonly number[] = [
  0x00000000, // +0
  0x80000000, // -0
  0x7fc00000, // NaN
  0x7f800000, // +infinity
  0xff800000, // -infinity
  0x00000001, // smallest denormal
  0x007fffff, // largest denormal
  0x00800000, // smallest normal
  0x7f7fffff, // largest finite
  0x3f800000, // 1
  0xbf800000, // -1
]

// Values are always float32: the original reads its inputs from float32 memory.
export const createFloatSampler = (random: SeededRandom): FloatSampler => {
  const sampleUniform = (limit: number): number =>
    Math.fround((random.nextFraction() * 2 - 1) * limit)
  const sampleMagnitude = (): number => {
    const exponent = random.nextIntegerBelow(61) - 30
    const sign = random.nextIntegerBelow(2) === 0 ? 1 : -1
    return Math.fround(sign * (1 + random.nextFraction()) * 2 ** exponent)
  }
  const sampleEdge = (): number =>
    getFloatFromBits(EDGE_BIT_PATTERNS[random.nextIntegerBelow(EDGE_BIT_PATTERNS.length)] ?? 0)
  const sampleAnyBits = (): number => getFloatFromBits(random.nextUnsignedInteger())
  // 70% ordinary values in the given range, 15% across the exponent range, 10% edge values, 5% random bit patterns.
  const sampleMixed = (limit: number): number => {
    const choice = random.nextIntegerBelow(100)
    if (choice < 70) return sampleUniform(limit)
    if (choice < 85) return sampleMagnitude()
    if (choice < 95) return sampleEdge()
    return sampleAnyBits()
  }
  // FSIN and FSINCOS leave the operand alone and set C2 at or beyond 2^63; Unicorn does the same for infinity and NaN,
  // where hardware raises the invalid-operation exception. The game cannot reach either, so angles stay in range.
  const sampleAngle = (limit: number): number => {
    const angle = sampleMixed(limit)
    return Number.isFinite(angle) && Math.abs(angle) < 2 ** 63 ? angle : sampleUniform(limit)
  }
  return {
    sampleIntegerBelow: (limit) => random.nextIntegerBelow(limit),
    getIsChance: (percent) => random.nextIntegerBelow(100) < percent,
    sampleAngle,
    sampleUniform,
    sampleMagnitude,
    sampleEdge,
    sampleAnyBits,
    sampleMixed,
    // Half of the lists hold ordinary values only, half hold the full mix.
    sampleList: (count, limit) =>
      Array.from(
        { length: count },
        random.nextIntegerBelow(2) === 0 ? () => sampleUniform(limit) : () => sampleMixed(limit)
      ),
  }
}

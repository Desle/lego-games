import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'

// 0x004b15d4 (1 / 1023): the jitter float a random table value becomes (0x00454b20).
const TABLE_VALUE_SCALE = Math.fround(1 / 1023)
// 0x004af58c: half.
const HALF = 0.5
// 0x004b1554: the jitter's range.
const JITTER_RANGE = 5
// 0x00454bb0 (the loop counter 4): the beam has four segments.
const SEGMENT_COUNT = 4
// 0x00454c3f..0x00454c66 (the array 0x004c7608 to 0x004c7644): five rings a segment.
const RINGS_PER_SEGMENT = 5
// 0x00454b71 (compare with 0x14) and 0x00454c43 (0x13): the wand's ring holds 20 values.
const SLOT_COUNT = 20

// 0x00454b20: the jitter float of one random table value.
export const getJitterValue = (arithmetic: FloatArithmetic, tableValue: number): number =>
  arithmetic.storeFloat(
    arithmetic.multiply(
      arithmetic.subtract(arithmetic.multiply(tableValue, TABLE_VALUE_SCALE), HALF),
      JITTER_RANGE
    )
  )

// 0x00454bb0: the rings of segment k take the slots below the one the next draw goes in, counting down and wrapping from
// 0 to 19, five to a segment; each jitter is (value, value, 0) in the segment's frame (0x004c7608 holds the segment's).
export const getWandJitter = (
  arithmetic: FloatArithmetic,
  draws: readonly number[],
  nextSlot: number
): readonly (readonly Vector3[])[] =>
  Array.from({ length: SEGMENT_COUNT }, (_segment, segmentIndex) =>
    Array.from({ length: RINGS_PER_SEGMENT }, (_ring, ringIndex) => {
      const offset = segmentIndex * RINGS_PER_SEGMENT + ringIndex + 1
      const slot = (((nextSlot - offset) % SLOT_COUNT) + SLOT_COUNT) % SLOT_COUNT
      const value = getJitterValue(arithmetic, draws[slot] ?? 0)
      return Object.freeze({ x: value, y: value, z: 0 })
    })
  )

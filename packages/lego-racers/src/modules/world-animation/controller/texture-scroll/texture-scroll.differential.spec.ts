import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import { getBitsFromFloat, getFloatFromBits } from '../../../../shared/emulator/float-bits.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createTextureScroll, getAdvancedTextureScroll } from './texture-scroll.ts'

// The mesh instance's vtable (0x10057270): slots +0x04 and +0x08 are the position getter and setter that 0x10027f40 calls.
const MESH_INSTANCE_VTABLE_ADDRESS = 0x10057270
const MESH_INSTANCE_BYTE_SIZE = 0x90
const OFFSET_WORDS_OFFSET = 0x60
const RATE_U_OFFSET = 0x64
const RATE_V_OFFSET = 0x68
const SIXTEEN_BITS = 0x10000
const FIRST_NOT_A_NUMBER_HALF_WORD = 0x7f80

// Input: the two offset words packed as the instance stores them (as float bits), the rates, the elapsed milliseconds.
const INPUT = Object.freeze({ offsets: 0, rateU: 1, rateV: 2, milliseconds: 3 })

// Words are held in float slots, so a result whose upper half is a NaN pattern (0x7f80 or 0xff80 and up) would hide
// its bits; the generator keeps both halves out of it.
const getIsComparable = (offsetWord: number): boolean =>
  (offsetWord >>> 16) % 0x8000 < FIRST_NOT_A_NUMBER_HALF_WORD

const getPackedOffsets = (offsetU: number, offsetV: number): number =>
  ((offsetV << 16) | offsetU) >>> 0

const getAdvancedWord = (input: readonly number[]): number => {
  const word = getBitsFromFloat(input[INPUT.offsets] ?? 0)
  const advanced = getAdvancedTextureScroll(
    {
      offsetU: word & 0xffff,
      offsetV: word >>> 16,
      rateU: getBitsFromFloat(input[INPUT.rateU] ?? 0),
      rateV: getBitsFromFloat(input[INPUT.rateV] ?? 0),
    },
    input[INPUT.milliseconds] ?? 0
  )
  return getPackedOffsets(advanced.offsetU, advanced.offsetV)
}

const generateScrollInput = (sampler: FloatSampler): readonly number[] => {
  for (;;) {
    const word = getPackedOffsets(
      sampler.sampleIntegerBelow(SIXTEEN_BITS),
      sampler.sampleIntegerBelow(SIXTEEN_BITS)
    )
    const input = [
      getFloatFromBits(word),
      getFloatFromBits(sampler.getIsChance(15) ? 0 : sampler.sampleIntegerBelow(SIXTEEN_BITS)),
      getFloatFromBits(sampler.getIsChance(15) ? 0 : sampler.sampleIntegerBelow(SIXTEEN_BITS)),
      sampler.getIsChance(10)
        ? sampler.sampleIntegerBelow(1_000_000)
        : sampler.sampleIntegerBelow(80),
    ]
    if (getIsComparable(word) && getIsComparable(getAdvancedWord(input))) return input
  }
}

// Instance_ApplyVelocity 0x10027f40 (thiscall: instance, integer milliseconds), through the real position methods of the
// mesh instance: the offset words at +0x60 and +0x62 advance by the 16-bit product of the milliseconds and the rates.
defineDifferentialSuite({
  definition: {
    name: 'Instance_ApplyVelocity texture scroll',
    address: 0x10027f40,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'instance',
        byteSize: MESH_INSTANCE_BYTE_SIZE,
        isArgument: true,
        fields: [
          { byteOffset: OFFSET_WORDS_OFFSET, start: INPUT.offsets, count: 1 },
          { byteOffset: RATE_U_OFFSET, start: INPUT.rateU, count: 1 },
          { byteOffset: RATE_V_OFFSET, start: INPUT.rateV, count: 1 },
        ],
        pointers: [{ byteOffset: 0, target: MESH_INSTANCE_VTABLE_ADDRESS }],
        outputs: [{ byteOffset: OFFSET_WORDS_OFFSET, floatCount: 1 }],
      },
      { kind: 'integerInput', index: INPUT.milliseconds },
    ],
    runPort: (_precision, input) => [getFloatFromBits(getAdvancedWord(input))],
  },
  generateInput: generateScrollInput,
  fixedInputs: [
    [getFloatFromBits(0), getFloatFromBits(0), getFloatFromBits(0), 33],
    [getFloatFromBits(0xfffe), getFloatFromBits(1), getFloatFromBits(0), 33],
    [getFloatFromBits(0x0001_0000), getFloatFromBits(0), getFloatFromBits(0xffff), 1],
    [getFloatFromBits(0x1234), getFloatFromBits(4000), getFloatFromBits(2000), 70_000],
  ],
})

// Instance_SetScrollRateU 0x10028110 (thiscall: instance, float per second): the rate is the value times 65.535,
// truncated; the rates here stay positive so that the word is a number when read back as a float.
defineDifferentialSuite({
  definition: {
    name: 'Instance_SetScrollRateU',
    address: 0x10028110,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'instance',
        byteSize: MESH_INSTANCE_BYTE_SIZE,
        isArgument: true,
        fields: [],
        pointers: [],
        outputs: [{ byteOffset: RATE_U_OFFSET, floatCount: 1 }],
      },
      { kind: 'float', index: 0 },
    ],
    runPort: (_precision, input) => [
      getFloatFromBits(createTextureScroll([input[0] ?? 0, 0]).rateU),
    ],
  },
  generateInput: (sampler) => [Math.abs(sampler.sampleUniform(40))],
  fixedInputs: [[0], [1], [4], [2], [0.5], [127.99]],
})

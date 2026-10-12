import {
  createFloatArithmetic,
  getFloatFromBits,
  getTruncatedInteger,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { TextureScroll } from '../../types/world-animation.types.ts'

const { multiply } = createFloatArithmetic(RACE_FPU_PRECISION)

// A world's scroll per second becomes a rate in 1/65536 of a texture per millisecond, and an offset of 65536 is one
// whole texture.
const RATE_PER_SECOND_SCALE = getFloatFromBits(0x4283126f) // float32 65.535 at GolDP.dll 0x100572d4
const OFFSET_UNIT = getFloatFromBits(0x37800000) // float32 2^-16 at GolDP.dll 0x100572d0
const SIXTEEN_BIT_MASK = 0xffff

export const NO_TEXTURE_SCROLL: TextureScroll = Object.freeze({
  offsetU: 0,
  offsetV: 0,
  rateU: 0,
  rateV: 0,
})

// 0x10028110 and 0x10028140 (called by World_LinkInstances 0x1002e640 for keyword 0x3f): the rate is the value times
// 65.535, truncated like _ftol.
const getRate = (scrollPerSecond: number): number =>
  getTruncatedInteger(multiply(scrollPerSecond, RATE_PER_SECOND_SCALE))

export const createTextureScroll = (values: readonly number[] | null): TextureScroll =>
  values === null
    ? NO_TEXTURE_SCROLL
    : Object.freeze({
        offsetU: 0,
        offsetV: 0,
        rateU: getRate(values[0] ?? 0),
        rateV: getRate(values[1] ?? 0),
      })

// LEGORacers.exe 0x00411700 and 0x00411730 (the same code as 0x10028110 and 0x10028140): new rates from a scroll per
// second, the offsets stay.
export const getTextureScrollWithRates = (
  scroll: TextureScroll,
  scrollPerSecondU: number,
  scrollPerSecondV: number
): TextureScroll =>
  Object.freeze({
    ...scroll,
    rateU: getRate(scrollPerSecondU),
    rateV: getRate(scrollPerSecondV),
  })

const getAdvancedOffset = (offset: number, rate: number, milliseconds: number): number =>
  (offset + Math.imul(milliseconds, rate)) & SIXTEEN_BIT_MASK

// 0x10027f40 (instance update, mesh vtable +0x10): with a rate set, each offset adds the 16-bit product of the elapsed
// milliseconds and its rate and wraps at 16 bits (IMUL and ADD on words).
export const getAdvancedTextureScroll = (
  scroll: TextureScroll,
  milliseconds: number
): TextureScroll =>
  scroll.rateU === 0 && scroll.rateV === 0
    ? scroll
    : Object.freeze({
        ...scroll,
        offsetU: getAdvancedOffset(scroll.offsetU, scroll.rateU, milliseconds),
        offsetV: getAdvancedOffset(scroll.offsetV, scroll.rateV, milliseconds),
      })

// 0x10028030: the drawn offsets are the words times 2^-16, added to every vertex's texture coordinates.
export const getTextureScrollOffsets = (scroll: TextureScroll): readonly [number, number] =>
  Object.freeze([
    Math.fround(scroll.offsetU * OFFSET_UNIT),
    Math.fround(scroll.offsetV * OFFSET_UNIT),
  ] as const)

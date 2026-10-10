import { getSignedByte } from '../../../../shared/binary-values/binary-values.ts'
import type { ComputerRacerRouteSample } from '../../../computer-racer-route/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { DecodedRouteSample } from '../racer-ai.types.ts'

// float32 constants at 0x004b4bcc, 0x004b4bd0, 0x004b4bd4 (0x3c010204) and 0x004b4bd8.
const HORIZONTAL_OFFSET_SCALE = 0.00390625
const VERTICAL_OFFSET_SCALE = 0.0625
const ROTATION_SCALE = Math.fround(0.007874015718698502)
const LATERAL_LIMIT_SCALE = 0.125
const CONTACT_STATE_SHIFT = 6
const CONTACT_STATE_CAPPED = 4
const DURATION_MASK = 0x3f
const DURATION_SHIFT = 5

// The computer-racer-route parser keeps sample bytes +4..+11 as bytes[0..7].
const getSampleByte = (sample: ComputerRacerRouteSample, offset: number): number =>
  sample.bytes[offset - 4] ?? 0

const getSignedSampleByte = (sample: ComputerRacerRouteSample, offset: number): number =>
  getSignedByte(getSampleByte(sample, offset))

// 0x004a5ec0: XOR EAX,EAX; MOV AL,[+0xb]; SHR EAX,6; values from 3 on read as 4.
export const getRouteSampleContactState = (sample: ComputerRacerRouteSample): number => {
  const state = getSampleByte(sample, 0xb) >> CONTACT_STATE_SHIFT
  return state < 3 ? state : CONTACT_STATE_CAPPED
}

// 0x004a5ee0: (byte 11 & 0x3f) << 5.
export const getRouteSampleDuration = (sample: ComputerRacerRouteSample): number =>
  (getSampleByte(sample, 0xb) & DURATION_MASK) << DURATION_SHIFT

// 0x004a5fa0: MOVSX byte 9, FILD, FMUL 0.125, left on the FPU stack.
export const getRouteSampleNegativeLateralLimit = (
  arithmetic: FloatArithmetic,
  sample: ComputerRacerRouteSample
): number => arithmetic.multiply(getSignedSampleByte(sample, 9), LATERAL_LIMIT_SCALE)

// 0x004a5fc0: the same for byte 10.
export const getRouteSamplePositiveLateralLimit = (
  arithmetic: FloatArithmetic,
  sample: ComputerRacerRouteSample
): number => arithmetic.multiply(getSignedSampleByte(sample, 10), LATERAL_LIMIT_SCALE)

// 0x004a5ef0: each component FILD, FMUL, FSTP float.
export const getRouteSampleOffset = (
  arithmetic: FloatArithmetic,
  sample: ComputerRacerRouteSample
) => {
  const { multiply, storeFloat } = arithmetic
  return Object.freeze({
    x: storeFloat(multiply(sample.first, HORIZONTAL_OFFSET_SCALE)),
    y: storeFloat(multiply(sample.second, HORIZONTAL_OFFSET_SCALE)),
    z: storeFloat(multiply(getSignedSampleByte(sample, 4), VERTICAL_OFFSET_SCALE)),
  })
}

// 0x004a5f40: bytes 5..8, each FILD, FMUL, FSTP float.
export const getRouteSampleRotation = (
  arithmetic: FloatArithmetic,
  sample: ComputerRacerRouteSample
) => {
  const { multiply, storeFloat } = arithmetic
  const getComponent = (offset: number): number =>
    storeFloat(multiply(getSignedSampleByte(sample, offset), ROTATION_SCALE))
  return Object.freeze({
    x: getComponent(5),
    y: getComponent(6),
    z: getComponent(7),
    w: getComponent(8),
  })
}

export const decodeRouteSample = (
  arithmetic: FloatArithmetic,
  sample: ComputerRacerRouteSample
): DecodedRouteSample =>
  Object.freeze({
    offset: getRouteSampleOffset(arithmetic, sample),
    rotation: getRouteSampleRotation(arithmetic, sample),
    negativeLateralLimit: getRouteSampleNegativeLateralLimit(arithmetic, sample),
    positiveLateralLimit: getRouteSamplePositiveLateralLimit(arithmetic, sample),
    contactState: getRouteSampleContactState(sample),
    durationMilliseconds: getRouteSampleDuration(sample),
  })

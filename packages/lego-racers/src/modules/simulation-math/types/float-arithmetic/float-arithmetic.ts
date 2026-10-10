import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import type {
  FloatArithmetic,
  FpuPrecision as FpuPrecisionValue,
} from '../simulation-math.types.ts'

// Unknown until the control word is read during a race; Direct3D's DDSCL_FPUSETUP suggests single.
export const RACE_FPU_PRECISION: FpuPrecisionValue = FpuPrecision.SINGLE

const roundToFloat32 = (value: number): number => Math.fround(value)

const FLOAT32_NORMAL_MINIMUM = 2 ** -126
const FLOAT32_SAFE_MAXIMUM = 2 ** 127
const DOUBLE_NORMAL_MINIMUM_EXPONENT = -1022
const exponentView = new DataView(new ArrayBuffer(8))

const getBinaryExponent = (magnitude: number): number => {
  exponentView.setFloat64(0, magnitude)
  return ((exponentView.getUint32(0) >>> 20) & 0x7ff) - 1023
}

// Precision control narrows the significand only: the x87's 15-bit exponent goes on past float32's range until a store.
const roundToSignificand24 = (value: number): number => {
  const magnitude = Math.abs(value)
  if (
    magnitude === 0 ||
    (magnitude >= FLOAT32_NORMAL_MINIMUM && magnitude < FLOAT32_SAFE_MAXIMUM)
  ) {
    return Math.fround(value)
  }
  if (!Number.isFinite(value)) return value
  const exponent = getBinaryExponent(magnitude)
  if (exponent < DOUBLE_NORMAL_MINIMUM_EXPONENT) return Math.fround(value)
  const scale = 2 ** -exponent
  return Math.fround(value * scale) / scale
}

const keepDouble = (value: number): number => value

// FCOM/FCOMP report an unordered (NaN) comparison as equal and below at once.
const getIsUnordered = (left: number, right: number): boolean =>
  Number.isNaN(left) || Number.isNaN(right)

// Doubles hold every product of two float32 values exactly, so one rounding to a 24-bit significand gives the x87 result.
export const createFloatArithmetic = (precision: FpuPrecisionValue): FloatArithmetic => {
  const roundOperation = precision === FpuPrecision.SINGLE ? roundToSignificand24 : keepDouble
  const arithmetic: FloatArithmetic = {
    precision,
    add: (left, right) => roundOperation(left + right),
    subtract: (left, right) => roundOperation(left - right),
    multiply: (left, right) => roundOperation(left * right),
    divide: (dividend, divisor) => roundOperation(dividend / divisor),
    getSquareRoot: (value) => roundOperation(Math.sqrt(value)),
    // Precision control does not apply to FSIN, FCOS and FSINCOS.
    getSine: (angle) => Math.sin(angle),
    getCosine: (angle) => Math.cos(angle),
    storeFloat: roundToFloat32,
    getIsEqual: (left, right) => left === right || getIsUnordered(left, right),
    getIsBelow: (left, right) => left < right || getIsUnordered(left, right),
    getIsBelowOrEqual: (left, right) => left <= right || getIsUnordered(left, right),
  }
  return Object.freeze(arithmetic)
}

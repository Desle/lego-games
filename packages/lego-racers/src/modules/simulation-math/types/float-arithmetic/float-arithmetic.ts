import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import type {
  FloatArithmetic,
  FpuPrecision as FpuPrecisionValue,
} from '../simulation-math.types.ts'

// Unknown until the control word is read during a race; Direct3D's DDSCL_FPUSETUP suggests single.
export const RACE_FPU_PRECISION: FpuPrecisionValue = FpuPrecision.SINGLE

const roundToFloat32 = (value: number): number => Math.fround(value)

const keepDouble = (value: number): number => value

// FCOM/FCOMP report an unordered (NaN) comparison as equal and below at once.
const getIsUnordered = (left: number, right: number): boolean =>
  Number.isNaN(left) || Number.isNaN(right)

// Doubles hold every product of two float32 values exactly, so one Math.fround gives the x87 24-bit result.
export const createFloatArithmetic = (precision: FpuPrecisionValue): FloatArithmetic => {
  const roundOperation = precision === FpuPrecision.SINGLE ? roundToFloat32 : keepDouble
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
    getTangent: (angle) => Math.tan(angle),
    storeFloat: roundToFloat32,
    getIsEqual: (left, right) => left === right || getIsUnordered(left, right),
    getIsBelow: (left, right) => left < right || getIsUnordered(left, right),
    getIsBelowOrEqual: (left, right) => left <= right || getIsUnordered(left, right),
  }
  return Object.freeze(arithmetic)
}

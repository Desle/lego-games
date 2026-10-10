import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { FpuPrecision as FpuPrecisionValues } from './fpu-precision/fpu-precision.ts'

export type FpuPrecision = EnumValues<typeof FpuPrecisionValues>

// One x87 instruction each. `storeFloat` is `FST`/`FSTP float ptr`, the only place a value is forced to float32.
export type FloatArithmetic = {
  readonly precision: FpuPrecision
  readonly add: (left: number, right: number) => number
  readonly subtract: (left: number, right: number) => number
  readonly multiply: (left: number, right: number) => number
  readonly divide: (dividend: number, divisor: number) => number
  readonly getSquareRoot: (value: number) => number
  readonly getSine: (angle: number) => number
  readonly getCosine: (angle: number) => number
  readonly storeFloat: (value: number) => number
  readonly getIsEqual: (left: number, right: number) => boolean
  readonly getIsBelow: (left: number, right: number) => boolean
  readonly getIsBelowOrEqual: (left: number, right: number) => boolean
}

export type Vector2 = {
  readonly x: number
  readonly y: number
}

export type Vector3 = {
  readonly x: number
  readonly y: number
  readonly z: number
}

// Stored as x, y, z, w (offsets 0, 4, 8, 12).
export type Quaternion = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}

// Row-major, nine float32 values in memory order; row vectors multiply from the left.
export type Matrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export type SineCosine = {
  readonly sine: number
  readonly cosine: number
}

// sqrt(radicand + 1) * 0.5 (stored) and 0.5 / sqrt(radicand + 1) (kept on the FPU stack), from 0x00449460.
export type HalfRoot = {
  readonly half: number
  readonly factor: number
}

// Rows 0 and 2 of a frame's rotation, as frame slot +0x48 (0x00403c90) returns them.
export type FrameAxes = {
  readonly first: Vector3
  readonly third: Vector3
}

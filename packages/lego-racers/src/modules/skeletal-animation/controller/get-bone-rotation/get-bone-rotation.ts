import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { BoneRotation } from '../../types/skeletal-animation.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, divide, multiply, storeFloat, subtract } = arithmetic

// 0x10056278 and 0x10056224.
const TWO = 2
const ONE = 1

// The identity rotation a bone starts with (constructor 0x10002890).
export const IDENTITY_BONE_ROTATION: BoneRotation = Object.freeze([
  1, 0, 0, 0, 1, 0, 0, 0, 1,
] as const)

const getOneMinus = (first: number, second: number): number => subtract(ONE, add(first, second))

// GolDP.dll 0x10002e30 (bone vtable +0x2c): the quaternion (x, y, z, w) scaled by 2 / |q|², then the usual
// rotation matrix terms written row after row; the instruction order and the float32 stores are the original's.
export const getBoneRotation = (
  quaternion: readonly [number, number, number, number]
): BoneRotation => {
  const [x, y, z, w] = quaternion
  const normSquared = add(add(add(multiply(x, x), multiply(y, y)), multiply(z, z)), multiply(w, w))
  const scale = divide(TWO, normSquared)
  const scaledX = storeFloat(multiply(scale, x))
  const scaledY = storeFloat(multiply(y, scale))
  const scaledZ = multiply(scale, z)
  const wx = storeFloat(multiply(w, scaledX))
  const wy = storeFloat(multiply(w, scaledY))
  const wz = storeFloat(multiply(w, scaledZ))
  const xx = storeFloat(multiply(scaledX, x))
  const xy = storeFloat(multiply(scaledY, x))
  const xz = storeFloat(multiply(scaledZ, x))
  const yy = storeFloat(multiply(y, scaledY))
  const yz = storeFloat(multiply(y, scaledZ))
  const zz = multiply(scaledZ, z)
  return Object.freeze([
    storeFloat(getOneMinus(zz, yy)),
    storeFloat(subtract(xy, wz)),
    storeFloat(add(xz, wy)),
    storeFloat(add(xy, wz)),
    storeFloat(getOneMinus(zz, xx)),
    storeFloat(subtract(yz, wx)),
    storeFloat(subtract(xz, wy)),
    storeFloat(add(yz, wx)),
    storeFloat(getOneMinus(yy, xx)),
  ] as const)
}

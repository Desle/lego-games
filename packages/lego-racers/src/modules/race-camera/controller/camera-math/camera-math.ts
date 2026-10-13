import {
  createFloatArithmetic,
  getNormalizedVector3,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import type { CameraNodeOrientation } from '../../types/race-camera.types.ts'

export const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

export const IDENTITY_BASIS: Matrix3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1])

// Float constants of the camera code (LEGORacers.exe .rdata).
// 0x004b03f0 and 0x004b02f8.
export const PI = Math.fround(Math.PI)
export const TWO_PI = Math.fround(2 * Math.PI)

// 0x00428f40(x, y): the angle of a unit vector, built from the C runtime's arccosine (0x004a8676). The x87 compares
// |y| with |x|, picks the better conditioned of the two arccosines and adds π/2 (0x004b0428) in the first
// quadrants pair. The result is stored as a float by both callers.
export const getHeadingAngle = (x: number, y: number): number => {
  const { storeFloat, getIsBelow, add } = arithmetic
  const quarterTurn = Math.fround(Math.PI / 2)
  const absoluteX = x < 0 ? -x : x
  const absoluteY = y < 0 ? -y : y
  if (getIsBelow(absoluteY, absoluteX)) {
    return storeFloat(x > 0 ? add(-Math.acos(y), quarterTurn) : add(Math.acos(y), quarterTurn))
  }
  return storeFloat(y > 0 ? Math.acos(x) : -Math.acos(x))
}

// 0x004282d0(forward, up, basis): row 2 is the normalized forward vector, row 1 the up vector made orthogonal to
// it and normalized, row 0 the cross product of rows 1 and 2.
export const getBasis = (forward: Vector3, up: Vector3): Matrix3 => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const row2 = getNormalizedVector3(arithmetic, forward)
  const alongForward = add(
    add(multiply(up.z, row2.z), multiply(up.y, row2.y)),
    multiply(row2.x, up.x)
  )
  const row1 = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(up.x, storeFloat(multiply(row2.x, alongForward)))),
    y: storeFloat(subtract(up.y, storeFloat(multiply(row2.y, alongForward)))),
    z: storeFloat(subtract(up.z, multiply(alongForward, row2.z))),
  })
  const basis: Matrix3 = [
    storeFloat(subtract(multiply(row1.y, row2.z), multiply(row1.z, row2.y))),
    storeFloat(subtract(multiply(row1.z, row2.x), multiply(row2.z, row1.x))),
    storeFloat(subtract(multiply(row2.y, row1.x), multiply(row1.y, row2.x))),
    row1.x,
    row1.y,
    row1.z,
    row2.x,
    row2.y,
    row2.z,
  ]
  return Object.freeze(basis)
}

export const getRow = (matrix: Matrix3, row: number): Vector3 =>
  Object.freeze({
    x: matrix[row * 3] ?? 0,
    y: matrix[row * 3 + 1] ?? 0,
    z: matrix[row * 3 + 2] ?? 0,
  })

// The camera node's orientation slot (GolDP.dll 0x10002a30, vtable +0x24) keeps forward normalized and up made orthogonal
// to it and normalized; its getter (0x100029d0, vtable +0x1c) hands both back. Race_UpdateState1 0x004349a0 reads them
// when the introduction camera is released.
export const getNodeOrientation = (forward: Vector3, up: Vector3): CameraNodeOrientation => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const unitForward = getNormalizedVector3(arithmetic, forward)
  const alongForward = add(
    add(multiply(up.y, unitForward.y), multiply(unitForward.z, up.z)),
    multiply(unitForward.x, up.x)
  )
  const unitUp = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(up.x, multiply(unitForward.x, alongForward))),
    y: storeFloat(subtract(up.y, multiply(unitForward.y, alongForward))),
    z: storeFloat(subtract(up.z, multiply(unitForward.z, alongForward))),
  })
  return Object.freeze({ forward: unitForward, up: unitUp })
}

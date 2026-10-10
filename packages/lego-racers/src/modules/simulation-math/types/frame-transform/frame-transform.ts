import type { FloatArithmetic, Frame, Matrix3, Vector3 } from '../simulation-math.types.ts'

const getElement = (rotation: Matrix3, index: number): number => rotation[index] ?? 0

// Each component is accumulated in the target and stored after every term, as the original writes it.
const getRowCombination = (
  arithmetic: FloatArithmetic,
  rotation: Matrix3,
  vector: Vector3,
  getIndex: (term: 0 | 1 | 2) => number
): number => {
  const { add, multiply, storeFloat } = arithmetic
  const first = storeFloat(multiply(getElement(rotation, getIndex(0)), vector.x))
  const second = storeFloat(add(multiply(getElement(rotation, getIndex(1)), vector.y), first))
  return storeFloat(add(multiply(getElement(rotation, getIndex(2)), vector.z), second))
}

// Frame slot +0x34, 0x00410c80 (thiscall: vector, target): vector × rotation (rotation at frame +0x28).
export const getFrameRotatedVector = (
  arithmetic: FloatArithmetic,
  frame: Frame,
  vector: Vector3
): Vector3 =>
  Object.freeze({
    x: getRowCombination(arithmetic, frame.rotation, vector, (term) => term * 3),
    y: getRowCombination(arithmetic, frame.rotation, vector, (term) => term * 3 + 1),
    z: getRowCombination(arithmetic, frame.rotation, vector, (term) => term * 3 + 2),
  })

// Frame slot +0x38, 0x00410cf0 (thiscall: vector, target): vector × transpose(rotation).
export const getFrameInverseRotatedVector = (
  arithmetic: FloatArithmetic,
  frame: Frame,
  vector: Vector3
): Vector3 =>
  Object.freeze({
    x: getRowCombination(arithmetic, frame.rotation, vector, (term) => term),
    y: getRowCombination(arithmetic, frame.rotation, vector, (term) => term + 3),
    z: getRowCombination(arithmetic, frame.rotation, vector, (term) => term + 6),
  })

// Frame slot +0x2c, 0x00410d60 (thiscall: point, target): point × rotation + position (+0x4c).
export const getFrameTransformedPoint = (
  arithmetic: FloatArithmetic,
  frame: Frame,
  point: Vector3
): Vector3 => {
  const { add, storeFloat } = arithmetic
  const rotated = getFrameRotatedVector(arithmetic, frame, point)
  return Object.freeze({
    x: storeFloat(add(frame.position.x, rotated.x)),
    y: storeFloat(add(frame.position.y, rotated.y)),
    z: storeFloat(add(frame.position.z, rotated.z)),
  })
}

// Frame slot +0x30, 0x00410de0 (thiscall: point, target): point × transpose(rotation) - position × transpose(rotation).
export const getFrameInverseTransformedPoint = (
  arithmetic: FloatArithmetic,
  frame: Frame,
  point: Vector3
): Vector3 => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const { rotation, position } = frame
  const rotated = getFrameInverseRotatedVector(arithmetic, frame, point)
  const offsetX = add(
    add(
      multiply(position.x, getElement(rotation, 0)),
      multiply(getElement(rotation, 1), position.y)
    ),
    multiply(position.z, getElement(rotation, 2))
  )
  const offsetY = add(
    add(
      multiply(position.z, getElement(rotation, 5)),
      multiply(getElement(rotation, 4), position.y)
    ),
    multiply(position.x, getElement(rotation, 3))
  )
  const offsetZ = add(
    add(
      multiply(getElement(rotation, 8), position.z),
      multiply(getElement(rotation, 7), position.y)
    ),
    multiply(position.x, getElement(rotation, 6))
  )
  return Object.freeze({
    x: storeFloat(subtract(rotated.x, offsetX)),
    y: storeFloat(subtract(rotated.y, offsetY)),
    z: storeFloat(subtract(rotated.z, offsetZ)),
  })
}

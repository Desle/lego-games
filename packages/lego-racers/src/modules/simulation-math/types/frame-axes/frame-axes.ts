import { getNormalizedVector3 } from '../vector/vector.ts'
import type {
  FloatArithmetic,
  FrameAxes,
  Matrix3,
  OrthonormalPair,
  Vector3,
} from '../simulation-math.types.ts'

// Frame slot +0x48, 0x00403c90 (thiscall: first target, third target): rows 0 and 2 of the rotation.
export const getFrameAxes = (rotation: Matrix3): FrameAxes =>
  Object.freeze({
    first: Object.freeze({ x: rotation[0], y: rotation[1], z: rotation[2] }),
    third: Object.freeze({ x: rotation[6], y: rotation[7], z: rotation[8] }),
  })

// The Gram-Schmidt step 0x00410900, 0x00410a00 and 0x00410b00 share: normalize the leading axis,
// remove it from the other (d·lead.x and d·lead.y stored, d·lead.z not) and normalize the rest.
const getOrthonormalPair = (
  arithmetic: FloatArithmetic,
  leading: Vector3,
  other: Vector3
): OrthonormalPair => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const lead = getNormalizedVector3(arithmetic, leading)
  const dot = add(
    add(multiply(other.y, lead.y), multiply(lead.z, other.z)),
    multiply(lead.x, other.x)
  )
  const orthogonal = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(other.x, storeFloat(multiply(lead.x, dot)))),
    y: storeFloat(subtract(other.y, storeFloat(multiply(lead.y, dot)))),
    z: storeFloat(subtract(other.z, multiply(dot, lead.z))),
  })
  return Object.freeze({ lead, orthogonal })
}

// lead × orthogonal as 0x00410a00 and 0x00410b00 compute it, each component stored.
const getCrossOfPair = (arithmetic: FloatArithmetic, pair: OrthonormalPair): Vector3 => {
  const { subtract, multiply, storeFloat } = arithmetic
  const { lead, orthogonal } = pair
  return Object.freeze({
    x: storeFloat(subtract(multiply(orthogonal.z, lead.y), multiply(orthogonal.y, lead.z))),
    y: storeFloat(subtract(multiply(lead.z, orthogonal.x), multiply(orthogonal.z, lead.x))),
    z: storeFloat(subtract(multiply(orthogonal.y, lead.x), multiply(lead.y, orthogonal.x))),
  })
}

const getRotationFromRows = (first: Vector3, second: Vector3, third: Vector3): Matrix3 =>
  Object.freeze([
    first.x,
    first.y,
    first.z,
    second.x,
    second.y,
    second.z,
    third.x,
    third.y,
    third.z,
  ])

// Frame slot +0x40, 0x00410900 (thiscall: first, third): Gram-Schmidt; row 1 is third × first.
export const getRotationFromFrameAxes = (arithmetic: FloatArithmetic, axes: FrameAxes): Matrix3 => {
  const { subtract, multiply, storeFloat } = arithmetic
  const { lead: first, orthogonal: third } = getOrthonormalPair(arithmetic, axes.first, axes.third)
  const second = {
    x: storeFloat(subtract(multiply(third.y, first.z), multiply(third.z, first.y))),
    y: storeFloat(subtract(multiply(third.z, first.x), multiply(first.z, third.x))),
    z: storeFloat(subtract(multiply(first.y, third.x), multiply(third.y, first.x))),
  }
  return getRotationFromRows(first, second, third)
}

// 0x00410a00 (thiscall: first, second): row 0 = normalize(first), row 1 = second made orthogonal, row 2 = row 0 × row 1.
export const getRotationFromFirstAndSecondAxes = (
  arithmetic: FloatArithmetic,
  first: Vector3,
  second: Vector3
): Matrix3 => {
  const pair = getOrthonormalPair(arithmetic, first, second)
  return getRotationFromRows(pair.lead, pair.orthogonal, getCrossOfPair(arithmetic, pair))
}

// 0x00410b00 (thiscall: third, first): row 2 = normalize(third), row 0 = first made orthogonal, row 1 = row 2 × row 0.
export const getRotationFromThirdAndFirstAxes = (
  arithmetic: FloatArithmetic,
  third: Vector3,
  first: Vector3
): Matrix3 => {
  const pair = getOrthonormalPair(arithmetic, third, first)
  return getRotationFromRows(pair.orthogonal, getCrossOfPair(arithmetic, pair), pair.lead)
}

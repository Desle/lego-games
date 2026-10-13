import { multiplyRotations, rotateVector } from '../builder-document/builder-document.ts'
import type { Vector } from '../../types/building.types.ts'

// A part's studs point along its own -y (LDraw's y points down).
export const PART_UP: Vector = [0, -1, 0]
const ALIGNED = 0.99

const getDot = (first: Vector, second: Vector): number =>
  first[0] * second[0] + first[1] * second[1] + first[2] * second[2]

export const getCross = (first: Vector, second: Vector): Vector => [
  first[1] * second[2] - first[2] * second[1],
  first[2] * second[0] - first[0] * second[2],
  first[0] * second[1] - first[1] * second[0],
]

// The LDraw axis (with its sign) nearest to a direction.
export const getNearestAxis = (direction: Vector): Vector => {
  const sizes = direction.map(Math.abs)
  const largest = sizes.indexOf(Math.max(...sizes))
  const getEntry = (axis: number) => (axis === largest ? Math.sign(direction[axis] ?? 0) || 1 : 0)
  return [getEntry(0), getEntry(1), getEntry(2)]
}

// Rounds a turn's entries so an axis-aligned turn stays exactly ±1 and 0 in the file.
export const cleanRotation = (rotation: readonly number[]): readonly number[] =>
  Object.freeze(rotation.map((value) => Number(value.toFixed(6)) + 0))

// A quarter turn about an LDraw axis (a unit vector along x, y or z): the right-hand turn, a a^T + [a]x since cos is 0 and sin 1.
export const getQuarterTurnAbout = (axis: Vector): readonly number[] => {
  const [x, y, z] = getNearestAxis(axis)
  return cleanRotation([
    x * x,
    x * y - z,
    x * z + y,
    y * x + z,
    y * y,
    y * z - x,
    z * x - y,
    z * y + x,
    z * z,
  ])
}

export const turnAbout = (rotation: readonly number[], axis: Vector): readonly number[] =>
  cleanRotation(multiplyRotations(getQuarterTurnAbout(axis), rotation))

// The least turn that makes a part's studs point along a direction (an LDraw axis), keeping its spin about that direction.
export const getFacingRotation = (
  rotation: readonly number[],
  direction: Vector
): readonly number[] => {
  const target = getNearestAxis(direction)
  const up = getNearestAxis(rotateVector(rotation, PART_UP))
  const alignment = getDot(up, target)
  if (alignment > ALIGNED) return cleanRotation(rotation)
  if (alignment < -ALIGNED) {
    const across = getNearestAxis(
      getCross(target, Math.abs(target[0]) > ALIGNED ? [0, 0, 1] : [1, 0, 0])
    )
    return turnAbout(turnAbout(rotation, across), across)
  }
  return turnAbout(rotation, getCross(up, target))
}

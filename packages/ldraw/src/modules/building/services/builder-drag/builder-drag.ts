import { PLATE_HEIGHT } from '../ldraw-units/ldraw-units.constants.ts'
import type { Vector } from '../../types/building.types.ts'

const SAME = 0.5
const LEVEL = 0.2

// The ground axis (0 for x, 2 for z) a drag across the ground goes most along: what ⇧ holds it to.
export const getDominantAxis = (offset: Vector): 0 | 2 =>
  Math.abs(offset[0]) >= Math.abs(offset[2]) ? 0 : 2

// A drag across the ground held to one axis: the other one dropped.
export const lockToAxis = (offset: Vector, axis: 0 | 2): Vector =>
  axis === 0 ? [offset[0], 0, 0] : [0, 0, offset[2]]

// Whether a move stays on the line of an axis across the ground (it may rise onto studs along it).
export const getIsAlongAxis = (offset: Vector, axis: 0 | 2): boolean =>
  Math.abs(axis === 0 ? offset[2] : offset[0]) < SAME

// Whether a move goes straight up or down.
export const getIsVertical = (offset: Vector): boolean =>
  Math.abs(offset[0]) < SAME && Math.abs(offset[2]) < SAME

// A drag up or down from one height to another (LDraw's y points down) in whole plates.
export const getPlateOffset = (fromHeight: number, toHeight: number): Vector => [
  0,
  PLATE_HEIGHT * Math.round((toHeight - fromHeight) / PLATE_HEIGHT) + 0,
  0,
]

// The height the cursor's ray points at above a grabbed point: where it crosses the upright plane through the point that faces the
// camera; null when the ray is near straight down (the plane would be edge on).
export const getRayHeight = (origin: Vector, direction: Vector, grabbed: Vector): number | null => {
  const level = Math.hypot(direction[0], direction[2])
  if (level < LEVEL) return null
  const normal: Vector = [direction[0] / level, 0, direction[2] / level]
  const across = (grabbed[0] - origin[0]) * normal[0] + (grabbed[2] - origin[2]) * normal[2]
  const along = direction[0] * normal[0] + direction[2] * normal[2]
  return origin[1] + (direction[1] * across) / along
}

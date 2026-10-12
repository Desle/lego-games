import type { LDrawWheelSet } from './ldraw-wheel-sets.types.ts'

// A tyre of the library with the rim made for it: the rim's seat is the tyre's bore (found by measuring both), and both are
// modelled about the same origin with the axle along z. Diameters and widths are the tyre's, in LDraw units (20 to a stud).
export const LDRAW_WHEEL_SETS: readonly LDrawWheelSet[] = Object.freeze([
  Object.freeze({ tyrePart: '51011', rimPart: '4624', diameter: 44, width: 16 }),
  Object.freeze({ tyrePart: '56890', rimPart: '6014b', diameter: 60, width: 28 }),
  Object.freeze({ tyrePart: '30391', rimPart: '11208', diameter: 76, width: 34 }),
  Object.freeze({ tyrePart: '2696', rimPart: '2994', diameter: 108, width: 32 }),
  Object.freeze({ tyrePart: '2857', rimPart: '2695', diameter: 122, width: 50 }),
  Object.freeze({ tyrePart: '4267', rimPart: '2695', diameter: 160, width: 50 }),
  Object.freeze({ tyrePart: '4410', rimPart: '6595c02', diameter: 204, width: 110 }),
])

// The set whose tyre is nearest to the diameter, by ratio (the drawing is then scaled to the exact size).
export const getWheelSet = (diameter: number): LDrawWheelSet =>
  LDRAW_WHEEL_SETS.reduce((nearest, candidate) =>
    Math.abs(Math.log(candidate.diameter / diameter)) <
    Math.abs(Math.log(nearest.diameter / diameter))
      ? candidate
      : nearest
  )

import { WheelKind } from './ldraw-wheel-sets.types.ts'
import type { LDrawWheelSet } from './ldraw-wheel-sets.types.ts'

const REDDISH_BROWN_COLOR_CODE = 70

const createTyreSet = (
  kind: WheelKind,
  tyrePart: string,
  rimPart: string,
  diameter: number,
  width: number
): LDrawWheelSet => Object.freeze({ kind, tyrePart, rimPart, diameter, width, rimColorCode: null })

const createWoodenSet = (part: string, diameter: number, width: number): LDrawWheelSet =>
  Object.freeze({
    kind: WheelKind.WOODEN_SPOKED,
    tyrePart: null,
    rimPart: part,
    diameter,
    width,
    rimColorCode: REDDISH_BROWN_COLOR_CODE,
  })

// A tyre of the library with the rim made for it: the rim's seat is the tyre's bore (found by measuring both), and both are
// modelled about the same origin with the axle along z. Diameters and widths are the parts', in LDraw units (20 to a stud).
const TREAD_SETS: readonly LDrawWheelSet[] = Object.freeze([
  createTyreSet(WheelKind.OFFROAD, '51011', '4624', 44, 16),
  createTyreSet(WheelKind.OFFROAD, '56890', '6014b', 60, 28),
  createTyreSet(WheelKind.OFFROAD, '30391', '11208', 76, 34),
  createTyreSet(WheelKind.OFFROAD, '2696', '2994', 108, 32),
  createTyreSet(WheelKind.OFFROAD, '2857', '2695', 122, 50),
  createTyreSet(WheelKind.OFFROAD, '4267', '2695', 160, 50),
  createTyreSet(WheelKind.OFFROAD, '4410', '6595c02', 204, 110),
])

export const LDRAW_WHEEL_SETS: Readonly<Record<WheelKind, readonly LDrawWheelSet[]>> =
  Object.freeze({
    // The wagon wheels of the library: one wooden part, with 8 or 10 spokes.
    [WheelKind.WOODEN_SPOKED]: Object.freeze([
      createWoodenSet('2470', 68, 20),
      createWoodenSet('4489a', 84, 20),
      createWoodenSet('33211', 108, 24),
      createWoodenSet('33212', 140, 24),
    ]),
    // The smooth slick tyre of the small wheel.
    [WheelKind.SLICK]: Object.freeze([createTyreSet(WheelKind.SLICK, '30028b', '30027b', 36, 20)]),
    [WheelKind.OFFROAD]: TREAD_SETS,
    // A spoked rim with a knobbly tyre.
    [WheelKind.SPOKED_OFFROAD]: Object.freeze([
      createTyreSet(WheelKind.SPOKED_OFFROAD, '2346', '30155', 70, 30),
    ]),
    // A drum as wide as two wheels (fused in the original's model): a tread set stretched to its width.
    [WheelKind.DRUM]: TREAD_SETS,
  })

// The set of this kind whose wheel is nearest to the diameter, by ratio (the drawing is then scaled to the exact size).
export const getWheelSet = (kind: WheelKind, diameter: number): LDrawWheelSet =>
  LDRAW_WHEEL_SETS[kind].reduce((nearest, candidate) =>
    Math.abs(Math.log(candidate.diameter / diameter)) <
    Math.abs(Math.log(nearest.diameter / diameter))
      ? candidate
      : nearest
  )

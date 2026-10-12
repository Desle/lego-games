import type { BrickFootprint } from '@lego-games/lego-racers/car-builder'
import type { BaseBounds, GridOffset, StudSpan } from './chassis-grid-offset.types.ts'

const LDRAW_UNITS_PER_STUD = 20
const LDRAW_UNITS_PER_PLATE = 8
const STUD_HEIGHT = 4
const ATTACHABLE_TOP_FLAG = 0x80
const HEIGHT_MASK = 0x3f
const NO_GRID_OFFSET: GridOffset = Object.freeze({ x: 0, y: 0, z: 0 })

// The height (LDU above the chassis brick's bottom) most attachable cells of the footprint have: where the first layer rests.
export const getDominantDeckHeight = (footprint: BrickFootprint): number => {
  const cellCountsByHeight = new Map<number, number>()
  for (let index = 0; index < footprint.width * footprint.height; index += 1) {
    const top = footprint.cells[index * 2] ?? 0
    if ((top & ATTACHABLE_TOP_FLAG) === 0) continue
    const height = top & HEIGHT_MASK
    cellCountsByHeight.set(height, (cellCountsByHeight.get(height) ?? 0) + 1)
  }
  let dominantHeight = 0
  let dominantCount = 0
  for (const [height, count] of cellCountsByHeight) {
    if (count > dominantCount) {
      dominantHeight = height
      dominantCount = count
    }
  }
  return dominantHeight * LDRAW_UNITS_PER_PLATE
}

const STUD_TOP_TOLERANCE = 1
const COORDINATES_PER_POINT = 3

const getMinimum = (values: readonly number[]): number =>
  values.reduce((minimum, value) => Math.min(minimum, value), Infinity)
const getMaximum = (values: readonly number[]): number =>
  values.reduce((maximum, value) => Math.max(maximum, value), -Infinity)

// The edges of a row of whole studs whose tops reach from `first` to `last`: centred between them (a stud's top is round), as many
// studs as fit (a top is narrower than a stud).
const getStudSpan = (first: number, last: number): StudSpan => {
  const centre = (first + last) / 2
  const halfWidth =
    ((Math.floor((last - first) / LDRAW_UNITS_PER_STUD) + 1) * LDRAW_UNITS_PER_STUD) / 2
  return Object.freeze({ minimum: centre - halfWidth, maximum: centre + halfWidth })
}

// The base's studded area from its points (x, y, z in turn, recipe axes): the highest points are the studs' tops. Wheel holders, pins
// and edges that reach past the studs do not count, so the grid's cells land on the studs.
export const getStudAreaBounds = (positions: readonly number[]): BaseBounds | null => {
  const ys = positions.filter((_, index) => index % COORDINATES_PER_POINT === 1)
  if (ys.length === 0) return null
  const top = getMinimum(ys)
  const studTopIndices = ys.flatMap((y, point) =>
    y <= top + STUD_TOP_TOLERANCE ? [point * COORDINATES_PER_POINT] : []
  )
  const xs = studTopIndices.map((index) => positions[index] ?? 0)
  const zs = studTopIndices.map((index) => positions[index + 2] ?? 0)
  const spanX = getStudSpan(getMinimum(xs), getMaximum(xs))
  const spanZ = getStudSpan(getMinimum(zs), getMaximum(zs))
  return Object.freeze({
    minimumX: spanX.minimum,
    maximumX: spanX.maximum,
    minimumY: top,
    minimumZ: spanZ.minimum,
    maximumZ: spanZ.maximum,
  })
}

// The shift that makes the base's edge fall on a cell boundary of the shifted grid while centring the grid on the base.
const getStudAlignedShift = (baseMinimum: number, baseMaximum: number, gridCentre: number) => {
  const centreShift = (baseMinimum + baseMaximum) / 2 - gridCentre
  return (
    baseMinimum +
    LDRAW_UNITS_PER_STUD * Math.round((centreShift - baseMinimum) / LDRAW_UNITS_PER_STUD)
  )
}

// The translation (LDU, recipe axes) for every built brick: the game's grid (10 x 6 cells from the footprint's corner, first layer
// at the footprint's deck height) is centred on the real base's studs, with its cells on the studs and its first layer on the deck.
export const getGridOffset = (footprint: BrickFootprint, bounds: BaseBounds | null): GridOffset => {
  if (bounds === null) return NO_GRID_OFFSET
  const deckTop = -bounds.minimumY - STUD_HEIGHT
  return Object.freeze({
    x: getStudAlignedShift(
      bounds.minimumX,
      bounds.maximumX,
      (footprint.width * LDRAW_UNITS_PER_STUD) / 2
    ),
    y: getDominantDeckHeight(footprint) - deckTop,
    z: getStudAlignedShift(
      bounds.minimumZ,
      bounds.maximumZ,
      (footprint.height * LDRAW_UNITS_PER_STUD) / 2
    ),
  })
}

import type { BrickFootprint } from '@lego-games/lego-racers/car-builder'
import type { PartStud } from '@lego-games/ldraw/building'
import { getDominantDeckPlates, getStudAlignedShift } from './chassis-grid-offset.ts'
import type { ChassisDeck, StudBase } from './chassis-deck.types.ts'

const LDRAW_UNITS_PER_STUD = 20
const LDRAW_UNITS_PER_PLATE = 8
const HALF_STUD = LDRAW_UNITS_PER_STUD / 2
const ATTACHABLE_TOP_FLAG = 0x80
const HEIGHT_MASK = 0x3f
// A stud counts when it points up: a side stud or one on a tilted part holds no brick of the grid.
const UPRIGHT = 0.99
// A stud belongs to the cell whose centre is this close along both axes (jumper and wedge plates put studs off the grid).
const CELL_ON_STUD_DISTANCE = 5
const PHASE_TOLERANCE = 0.5
const LEVEL_PRECISION = 10

const getModulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor

const getRounded = (value: number): number => Math.round(value * LEVEL_PRECISION) / LEVEL_PRECISION

const getMostCommon = (values: readonly number[]): number | null => {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let mostCommon: number | null = null
  let mostCount = 0
  for (const [value, count] of counts) {
    if (count > mostCount) {
      mostCommon = value
      mostCount = count
    }
  }
  return mostCommon
}

// The bases of the studs that point up.
export const getStudBases = (studs: readonly PartStud[]): readonly StudBase[] =>
  Object.freeze(
    studs
      .filter((stud) => stud.direction[1] < -UPRIGHT)
      .map((stud) =>
        Object.freeze({ x: stud.position[0], y: stud.position[1], z: stud.position[2] })
      )
  )

const getPhase = (coordinate: number): number =>
  getModulo(
    getRounded(getModulo(coordinate - HALF_STUD, LDRAW_UNITS_PER_STUD)),
    LDRAW_UNITS_PER_STUD
  )

// The shift along one axis that puts the grid's cell centres on the studs most of them line up with, centred on those studs.
const getAxisShift = (coordinates: readonly number[], gridCentre: number): number => {
  const phase = getMostCommon(coordinates.map(getPhase)) ?? 0
  const onPhase = coordinates.filter((coordinate) => {
    const distance = getModulo(getPhase(coordinate) - phase, LDRAW_UNITS_PER_STUD)
    return Math.min(distance, LDRAW_UNITS_PER_STUD - distance) <= PHASE_TOLERANCE
  })
  const minimum = onPhase.reduce((least, value) => Math.min(least, value), Infinity)
  const maximum = onPhase.reduce((most, value) => Math.max(most, value), -Infinity)
  return getStudAlignedShift(minimum - HALF_STUD, maximum + HALF_STUD, gridCentre)
}

const getFootprintWithTops = (
  footprint: BrickFootprint,
  getTop: (top: number, cellIndex: number) => number
): BrickFootprint =>
  Object.freeze({
    ...footprint,
    cells: Uint8Array.from(footprint.cells, (value, index) =>
      index % 2 === 0 ? getTop(value, index / 2) : value
    ),
  })

const getAttachableTop = (top: number, plates: number): number =>
  (top & ~(HEIGHT_MASK | ATTACHABLE_TOP_FLAG)) | ATTACHABLE_TOP_FLAG | plates

// The highest stud base (least y) over each footprint cell, by the cell's index.
const getCellLevels = (
  footprint: BrickFootprint,
  studBases: readonly StudBase[],
  shiftX: number,
  shiftZ: number
): ReadonlyMap<number, number> => {
  const cellLevels = new Map<number, number>()
  for (let x = 0; x < footprint.width; x += 1) {
    for (let y = 0; y < footprint.height; y += 1) {
      const centreX = (x + 0.5) * LDRAW_UNITS_PER_STUD + shiftX
      const centreZ = (y + 0.5) * LDRAW_UNITS_PER_STUD + shiftZ
      const highest = studBases
        .filter(
          (stud) =>
            Math.abs(stud.x - centreX) <= CELL_ON_STUD_DISTANCE &&
            Math.abs(stud.z - centreZ) <= CELL_ON_STUD_DISTANCE
        )
        .reduce((least, stud) => Math.min(least, stud.y), Infinity)
      if (highest !== Infinity) cellLevels.set(x * footprint.height + y, highest)
    }
  }
  return cellLevels
}

// The chassis's grid on the recipe's studs: every cell over an upright stud takes a brick with its bottom on that stud's base (the
// highest one there), in whole plates from the level most cells share, which keeps the game's main deck height. Null without studs.
export const getChassisDeck = (
  footprint: BrickFootprint,
  studBases: readonly StudBase[]
): ChassisDeck | null => {
  if (studBases.length === 0) return null
  const shiftX = getAxisShift(
    studBases.map((stud) => stud.x),
    (footprint.width * LDRAW_UNITS_PER_STUD) / 2
  )
  const shiftZ = getAxisShift(
    studBases.map((stud) => stud.z),
    (footprint.height * LDRAW_UNITS_PER_STUD) / 2
  )
  const cellLevels = getCellLevels(footprint, studBases, shiftX, shiftZ)
  const deckLevel = getMostCommon([...cellLevels.values()].map(getRounded))
  if (deckLevel === null) return null
  const getRelativePlates = (level: number): number =>
    Math.round((deckLevel - level) / LDRAW_UNITS_PER_PLATE)
  const lowestRelative = [...cellLevels.values()].reduce(
    (lowest, level) => Math.min(lowest, getRelativePlates(level)),
    0
  )
  // A cell 0 plates high is empty to the game, so the lowest level stands at least a plate up.
  const deckPlates = Math.max(getDominantDeckPlates(footprint), 1 - lowestRelative)
  const getStudTop = (top: number, cellIndex: number): number | null => {
    const level = cellLevels.get(cellIndex)
    return level === undefined
      ? null
      : getAttachableTop(top, Math.min(HEIGHT_MASK, deckPlates + getRelativePlates(level)))
  }
  return Object.freeze({
    gridOffset: Object.freeze({
      x: shiftX,
      y: deckPlates * LDRAW_UNITS_PER_PLATE + deckLevel,
      z: shiftZ,
    }),
    studFootprint: getFootprintWithTops(
      footprint,
      (top, cellIndex) => getStudTop(top, cellIndex) ?? top & ~ATTACHABLE_TOP_FLAG
    ),
    deckFootprint: getFootprintWithTops(
      footprint,
      (top, cellIndex) =>
        getStudTop(top, cellIndex) ??
        ((top & ATTACHABLE_TOP_FLAG) === 0 ? top : getAttachableTop(top, deckPlates))
    ),
    cellLifts: Object.freeze(
      Array.from({ length: footprint.width * footprint.height }, (_unused, cellIndex) => {
        const level = cellLevels.get(cellIndex)
        return level === undefined
          ? 0
          : (deckLevel - level) / LDRAW_UNITS_PER_PLATE - getRelativePlates(level)
      })
    ),
  })
}

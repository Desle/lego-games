import type { CarDesign, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import { Matrix4 } from 'three'
import { getLDrawBrickColor } from './ldraw-brick-colors.ts'
import { LDRAW_BRICK_MAPPINGS } from './ldraw-brick-mappings.ts'
import type { LDrawBrickMapping } from './ldraw-brick-mappings.types.ts'
import type { CarOrigin, LDrawCarDocument } from './ldraw-car-document.types.ts'

// LDraw: 20 units to a stud, 8 to a plate; the game: a stud is 1 and a plate (a brick height unit) 0.4.
export const LDRAW_UNITS_PER_STUD = 20
const LDRAW_UNITS_PER_PLATE = 8
const QUARTER_TURN = Math.PI / 2
const MATRIX_DIGITS = 4

// LDraw axes (x right, y down, z toward the viewer) into the game's (x, y, z up): (x, y, z) becomes (x, z, -y).
export const LDRAW_TO_GAME = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1)
const GAME_TO_LDRAW = LDRAW_TO_GAME.clone().invert()

// 0x0049a450: the brick turned about the footprint's corner by its orientation (a quarter turn per step, clockwise).
const getOrientationMatrix = (width: number, height: number, orientation: number): Matrix4 => {
  const widthUnits = width * LDRAW_UNITS_PER_STUD
  const heightUnits = height * LDRAW_UNITS_PER_STUD
  switch (orientation & 3) {
    case 1:
      return new Matrix4()
        .makeTranslation(0, widthUnits, 0)
        .multiply(new Matrix4().makeRotationZ(-QUARTER_TURN))
    case 2:
      return new Matrix4()
        .makeTranslation(widthUnits, heightUnits, 0)
        .multiply(new Matrix4().makeRotationZ(Math.PI))
    case 3:
      return new Matrix4()
        .makeTranslation(heightUnits, 0, 0)
        .multiply(new Matrix4().makeRotationZ(QUARTER_TURN))
    default:
      return new Matrix4()
  }
}

// The part's points into the brick's frame (see LDrawBrickMapping).
const getPartMatrix = (mapping: LDrawBrickMapping): Matrix4 =>
  new Matrix4()
    .makeTranslation(...mapping.offset)
    .multiply(new Matrix4().makeRotationZ(mapping.quarterTurns * QUARTER_TURN))
    .multiply(new Matrix4().makeScale(mapping.isMirrored ? -1 : 1, 1, 1))
    .multiply(LDRAW_TO_GAME)

// The matrix, in game axes and LDraw units, that takes a part's points to where the brick stands in the car.
export const getBrickPlacementMatrix = (
  brick: PlacedBrick,
  mapping: LDrawBrickMapping,
  origin: CarOrigin
): Matrix4 => {
  const { width, height } = brick.piece.footprint
  const placement = new Matrix4().makeTranslation(
    (brick.x + origin.x) * LDRAW_UNITS_PER_STUD,
    (brick.y + origin.y) * LDRAW_UNITS_PER_STUD,
    brick.baseHeight * LDRAW_UNITS_PER_PLATE + origin.z * LDRAW_UNITS_PER_STUD
  )
  return placement
    .multiply(getOrientationMatrix(width, height, brick.orientation))
    .multiply(getPartMatrix(mapping))
}

const formatNumber = (value: number): string => String(Number(value.toFixed(MATRIX_DIGITS)) + 0)

// An LDraw type 1 line: `1 <colour> x y z a b c d e f g h i <file>`, the nine numbers being the matrix rows.
const getPartLine = (colorCode: number, matrix: Matrix4, partNumber: string): string => {
  const [m11, m21, m31, , m12, m22, m32, , m13, m23, m33, , m14, m24, m34] = matrix.elements
  const numbers = [m14, m24, m34, m11, m12, m13, m21, m22, m23, m31, m32, m33]
  return `1 ${String(colorCode)} ${numbers.map((value) => formatNumber(value)).join(' ')} ${partNumber}.dat`
}

export const getLDrawMapping = (brick: PlacedBrick): LDrawBrickMapping | null =>
  LDRAW_BRICK_MAPPINGS[brick.piece.name] ?? null

// The design as an LDraw model whose axes are the library's; `LDRAW_TO_GAME` takes it back to the game's.
export const createLDrawCarDocument = (design: CarDesign, origin: CarOrigin): LDrawCarDocument => {
  const lines: string[] = []
  const partNumbers = new Set<string>()
  const unmappedBricks: PlacedBrick[] = []
  for (const brick of design.bricks) {
    const mapping = getLDrawMapping(brick)
    if (mapping === null) {
      unmappedBricks.push(brick)
      continue
    }
    const matrix = GAME_TO_LDRAW.clone().multiply(getBrickPlacementMatrix(brick, mapping, origin))
    lines.push(getPartLine(getLDrawBrickColor(brick.colorIndex).code, matrix, mapping.partNumber))
    partNumbers.add(mapping.partNumber)
  }
  return Object.freeze({
    text: lines.join('\n'),
    partNumbers: Object.freeze([...partNumbers]),
    unmappedBricks: Object.freeze(unmappedBricks),
  })
}

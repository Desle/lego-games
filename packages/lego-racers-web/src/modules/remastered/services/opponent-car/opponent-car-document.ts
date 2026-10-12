import { Matrix4 } from 'three'
import { getLDrawBrickColor } from '../ldraw-car/ldraw-brick-colors.ts'
import { getPartLine, LDRAW_UNITS_PER_STUD } from '../ldraw-car/ldraw-car-document.ts'
import { PLATE_HEIGHT } from './body-voxels.ts'
import { findBoxPart } from './opponent-box-parts.ts'
import type { OpponentBrick, OpponentCarDesign } from './opponent-car.types.ts'

const LONG_ALONG_Y = 1

// An LDraw brick or plate stands with its top face at its origin, in the middle of its footprint, its long side along x. In the
// library's axes x is the game's x, y is down (the game's z up, negated) and z is the game's y.
const getBoxLine = (brick: OpponentBrick, offset: readonly [number, number, number]): string => {
  const [name, x, y, orientation, colorIndex, baseHeight] = brick
  const part = findBoxPart(name)
  if (part === null) return ''
  const isAlongY = orientation === LONG_ALONG_Y
  const countX = isAlongY ? part.width : part.length
  const countY = isAlongY ? part.length : part.width
  const top = offset[2] + (baseHeight + part.height) * PLATE_HEIGHT
  const matrix = new Matrix4()
    .makeTranslation(
      (offset[0] + x + countX / 2) * LDRAW_UNITS_PER_STUD,
      -top * LDRAW_UNITS_PER_STUD,
      (offset[1] + y + countY / 2) * LDRAW_UNITS_PER_STUD
    )
    .multiply(new Matrix4().makeRotationY(isAlongY ? -Math.PI / 2 : 0))
  return getPartLine(getLDrawBrickColor(colorIndex).code, matrix, part.partNumber)
}

// The lines of the LDraw model for the design's plain bricks and plates (the catalogue pieces are the car design's).
export const createBoxPartLines = (design: OpponentCarDesign): string =>
  design.bricks
    .map((brick) => getBoxLine(brick, design.offset))
    .filter((line) => line !== '')
    .join('\n')

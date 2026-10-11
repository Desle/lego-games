import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { getCellBottom, getFootprintCell, getOrientedSize } from '../build-grid/build-grid.ts'
import type {
  CarDesign,
  CarWeight,
  CellMoments,
  PlacedBrick,
} from '../../types/car-builder.types.ts'

// Pieces from this id on are the builder's own bricks; the lower ids are chassis parts, which weigh nothing.
const FIRST_BRICK_ID = 0x800
const HEIGHT_MASK = 0x3f
// The middle of the 10 by 6 grid in x and y: 0x004b4944 (4.5) and 0x004b4940 (2.5).
const GRID_CENTRE_X = getFloatFromBits(0x40900000)
const GRID_CENTRE_Y = getFloatFromBits(0x40200000)

const ZERO_MOMENTS: CellMoments = Object.freeze({ cellCount: 0, xSum: 0, ySum: 0, zSum: 0 })

// 0x0049f560 (BuildPiece_GetCellMoments): for each cell of the oriented footprint the unit cells between its bottom and
// its top: their number, and the sums of the cell's x, its y and each unit's height (base height plus its level), the
// first two weighted by that number.
const getBrickMoments = (brick: PlacedBrick): CellMoments => {
  const size = getOrientedSize(brick.piece.footprint, brick.orientation)
  let moments = ZERO_MOMENTS
  for (let rowIndex = 0; rowIndex < size.height; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < size.width; columnIndex += 1) {
      const { top, bottom } = getFootprintCell(
        brick.piece.footprint,
        columnIndex,
        rowIndex,
        brick.orientation
      )
      const topHeight = top & HEIGHT_MASK
      const bottomHeight = getCellBottom(top, bottom)
      const cellCount = topHeight - bottomHeight
      let zSum = 0
      for (let level = bottomHeight; level < topHeight; level += 1) zSum += brick.baseHeight + level
      moments = {
        cellCount: moments.cellCount + cellCount,
        xSum: moments.xSum + (brick.x + columnIndex) * cellCount,
        ySum: moments.ySum + (brick.y + rowIndex) * cellCount,
        zSum: moments.zSum + zSum,
      }
    }
  }
  return moments
}

// CarBuilder_GetWeightAndCentre 0x0049c6a0: over the bricks of the builder's own (id 0x800 and up), the number of unit
// cells W, and the centroid of those cells: x and y relative to the middle of the grid (4.5, 2.5) and z as it is. A
// design without such a brick weighs 0 and has its centre at 0, 0, 0. The racer slot takes W as the weight (+0x14),
// and the offsets of x and y (+0x18, +0x1c) and z (+0x20).
export const getCarWeight = (arithmetic: FloatArithmetic, design: CarDesign): CarWeight => {
  const { divide, subtract, storeFloat } = arithmetic
  const total = design.bricks
    .filter((brick) => brick.piece.id >= FIRST_BRICK_ID)
    .map(getBrickMoments)
    .reduce(
      (sum, moments): CellMoments => ({
        cellCount: sum.cellCount + moments.cellCount,
        xSum: sum.xSum + moments.xSum,
        ySum: sum.ySum + moments.ySum,
        zSum: sum.zSum + moments.zSum,
      }),
      ZERO_MOMENTS
    )
  if (total.cellCount === 0) {
    return Object.freeze({ weight: 0, centreOffsetX: 0, centreOffsetY: 0, centreHeight: 0 })
  }
  return Object.freeze({
    weight: total.cellCount,
    centreOffsetX: storeFloat(subtract(divide(total.xSum, total.cellCount), GRID_CENTRE_X)),
    centreOffsetY: storeFloat(subtract(divide(total.ySum, total.cellCount), GRID_CENTRE_Y)),
    centreHeight: storeFloat(divide(total.zSum, total.cellCount)),
  })
}

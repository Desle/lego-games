import type {
  BrickFootprint,
  BuildGrid,
  FootprintCell,
  GridCell,
  OrientedSize,
  PlacedBrick,
  PlacementResult,
} from '../../types/car-builder.types.ts'

// 0x0049e230 from 0x00499fc0: the build grid is 10 cells wide and 6 deep.
export const BUILD_GRID_WIDTH = 10
export const BUILD_GRID_HEIGHT = 6
// 0x0049f8e0 from 0x00499fc0: a design holds at most 0x40 bricks.
export const MAXIMUM_BRICK_COUNT = 0x40

const HEIGHT_MASK = 0x3f
const ATTACHABLE_TOP_FLAG = 0x80
const CONNECTOR_FLAG = 0x80
const RELAXED_OVERLAP_MASK = 0xc0
const NO_SUPPORT = -1

const EMPTY_CELL: GridCell = Object.freeze({ brickIndex: -1, height: 0, isAttachable: false })

// 0x0049e280: every cell empty (0x0049df20: brick -1, height 0, not attachable).
export const createBuildGrid = (
  width: number = BUILD_GRID_WIDTH,
  height: number = BUILD_GRID_HEIGHT
): BuildGrid =>
  Object.freeze({
    width,
    height,
    cells: Object.freeze(Array.from({ length: width * height }, () => EMPTY_CELL)),
  })

// The footprint's extent after the orientation: a quarter turn (bit 0) swaps the two (0x0049eb20, 0x0049eb30).
export const getOrientedSize = (footprint: BrickFootprint, orientation: number): OrientedSize =>
  (orientation & 1) === 0
    ? { width: footprint.width, height: footprint.height }
    : { width: footprint.height, height: footprint.width }

// 0x0049ea60: the footprint cell at (x, y) of the oriented shape, as its top and bottom bytes.
export const getFootprintCell = (
  footprint: BrickFootprint,
  x: number,
  y: number,
  orientation: number
): FootprintCell => {
  const { width, height } = footprint
  const isQuarterTurn = (orientation & 1) !== 0
  const isHalfTurn = (orientation & 2) !== 0
  const getIndex = (): number => {
    if (!isQuarterTurn) {
      return isHalfTurn ? (width - x) * height - y - 1 : height * x + y
    }
    return isHalfTurn ? (y + 1) * height - x - 1 : (width - y - 1) * height + x
  }
  const index = getIndex() * 2
  return { top: footprint.cells[index] ?? 0, bottom: footprint.cells[index + 1] ?? 0 }
}

// The part of a cell below the top, forced to 0 when it lies above it (0x0049e2d0 and the code around it).
export const getCellBottom = (top: number, bottom: number): number => {
  const bottomHeight = bottom & HEIGHT_MASK
  return (top & HEIGHT_MASK) < bottomHeight ? 0 : bottomHeight
}

const getGridCell = (grid: BuildGrid, x: number, y: number): GridCell =>
  grid.cells[x * grid.height + y] ?? EMPTY_CELL

const getIsEmptyCell = (top: number, bottom: number): boolean =>
  ((top | bottom) & HEIGHT_MASK) === 0

// 0x0049e2d0: where a brick would rest. A brick rests on the highest attachable top under one of its connectors (the
// height of that top less the connector's bottom), or on the floor when `isAutoHeight` and its bottom is at 0. -1: it
// touches nothing it could attach to. Outside the grid: -2 (negative position), -3 (too far in x), -4 (in y).
export const getRestingHeight = (
  grid: BuildGrid,
  footprint: BrickFootprint,
  x: number,
  y: number,
  orientation: number,
  isAutoHeight: boolean
): number => {
  if (x < 0 || y < 0) return -2
  const size = getOrientedSize(footprint, orientation)
  if (size.width + x > grid.width) return -3
  if (size.height + y > grid.height) return -4
  let resting = NO_SUPPORT
  for (let columnIndex = 0; columnIndex < size.width; columnIndex += 1) {
    for (let rowIndex = 0; rowIndex < size.height; rowIndex += 1) {
      const cell = getGridCell(grid, x + columnIndex, y + rowIndex)
      const { top, bottom } = getFootprintCell(footprint, columnIndex, rowIndex, orientation)
      if (!cell.isAttachable) {
        if (isAutoHeight && cell.height === 0) {
          resting = Math.max(resting, 0 - getCellBottom(top, bottom))
        }
      } else if ((bottom & CONNECTOR_FLAG) !== 0) {
        resting = Math.max(resting, cell.height - getCellBottom(top, bottom))
      }
    }
  }
  return resting
}

// 0x0049e450: how many cells the brick would collide with at that base height. A cell collides when the brick's bottom
// lies below the top of what is there, or exactly at it where the top takes attachments and the brick's bottom byte
// does not relax the test (bits 6 and 7). A negative height cannot be placed: every cell counts, plus one.
export const getOverlapCount = (
  grid: BuildGrid,
  footprint: BrickFootprint,
  x: number,
  y: number,
  orientation: number,
  baseHeight: number
): number => {
  const size = getOrientedSize(footprint, orientation)
  if (baseHeight < 0) return footprint.width * footprint.height + 1
  let count = 0
  for (let columnIndex = 0; columnIndex < size.width; columnIndex += 1) {
    for (let rowIndex = 0; rowIndex < size.height; rowIndex += 1) {
      const cell = getGridCell(grid, x + columnIndex, y + rowIndex)
      const { top, bottom } = getFootprintCell(footprint, columnIndex, rowIndex, orientation)
      if (getIsEmptyCell(top, bottom)) continue
      const cellHeight = (cell.height - baseHeight) >>> 0
      const bottomHeight = getCellBottom(top, bottom)
      const isBelow = bottomHeight < cell.height - baseHeight
      const isAtAttachable =
        cellHeight === bottomHeight && cell.isAttachable && (bottom & RELAXED_OVERLAP_MASK) === 0
      if (isBelow || isAtAttachable) count += 1
    }
  }
  return count
}

// 0x0049df40 (without the callback): the cells under the brick now hold its top: the height of the top byte above the
// base, whether it takes attachments, and the brick's index.
export const getGridWithBrick = (
  grid: BuildGrid,
  brick: PlacedBrick,
  brickIndex: number
): BuildGrid => {
  const { footprint } = brick.piece
  const size = getOrientedSize(footprint, brick.orientation)
  const cells = [...grid.cells]
  for (let columnIndex = 0; columnIndex < size.width; columnIndex += 1) {
    for (let rowIndex = 0; rowIndex < size.height; rowIndex += 1) {
      const { top, bottom } = getFootprintCell(footprint, columnIndex, rowIndex, brick.orientation)
      if (getIsEmptyCell(top, bottom)) continue
      cells[(brick.x + columnIndex) * grid.height + brick.y + rowIndex] = Object.freeze({
        brickIndex,
        height: (top & HEIGHT_MASK) + brick.baseHeight,
        isAttachable: (top & ATTACHABLE_TOP_FLAG) !== 0,
      })
    }
  }
  return Object.freeze({ ...grid, cells: Object.freeze(cells) })
}

// 0x0049eb40: the tallest cell of a footprint.
export const getFootprintHeight = (footprint: BrickFootprint): number => {
  let tallest = 0
  for (let index = 0; index < footprint.width * footprint.height; index += 1) {
    tallest = Math.max(tallest, (footprint.cells[index * 2] ?? 0) & HEIGHT_MASK)
  }
  return tallest
}

// 0x0049e710: place a brick if it rests somewhere and collides with nothing.
export const getPlacement = (
  grid: BuildGrid,
  footprint: BrickFootprint,
  x: number,
  y: number,
  orientation: number,
  isAutoHeight: boolean
): PlacementResult => {
  const baseHeight = getRestingHeight(grid, footprint, x, y, orientation, isAutoHeight)
  if (baseHeight < 0) return { isPlaceable: false }
  if (getOverlapCount(grid, footprint, x, y, orientation, baseHeight) !== 0) {
    return { isPlaceable: false }
  }
  return { isPlaceable: true, baseHeight }
}

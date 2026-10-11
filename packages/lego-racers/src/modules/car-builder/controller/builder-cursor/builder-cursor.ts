import type { BrickPiece } from '../../types/car-builder.types.ts'
import type {
  BuilderAnchor,
  BuilderCursor,
  BuilderExtent,
  BuilderMoveResult,
  BuilderTopLeft,
} from '../../types/builder-session/builder-session.types.ts'
import { BUILD_GRID_HEIGHT, BUILD_GRID_WIDTH } from '../build-grid/build-grid.ts'

const TOP_LEFT = 0
const BOTTOM_LEFT = 1
const TOP_RIGHT = 2
const BOTTOM_RIGHT = 3
// 0x004997e0 splits the grid in four at these cells.
const HALF_WIDTH_CELL = 5
const HALF_HEIGHT_CELL = 3

// The rectangle's extent along the grid's x and y after the orientation (a quarter turn swaps the footprint's two sides).
const getBuilderExtent = (piece: BrickPiece, orientation: number): BuilderExtent =>
  (orientation & 1) === 0
    ? { width: piece.footprint.width, height: piece.footprint.height }
    : { width: piece.footprint.height, height: piece.footprint.width }

// 0x00499640: the anchor is the rectangle's corner `pivotCorner`.
const getAnchor = (
  x: number,
  y: number,
  extent: BuilderExtent,
  pivotCorner: number
): BuilderAnchor => ({
  anchorX: pivotCorner === TOP_RIGHT || pivotCorner === BOTTOM_RIGHT ? x + extent.width : x,
  anchorY: pivotCorner === BOTTOM_LEFT || pivotCorner === BOTTOM_RIGHT ? y + extent.height : y,
})

// 0x00499570: the top left cell from the anchor.
const getTopLeft = (
  anchorX: number,
  anchorY: number,
  extent: BuilderExtent,
  pivotCorner: number
): BuilderTopLeft => ({
  x: pivotCorner === TOP_RIGHT || pivotCorner === BOTTOM_RIGHT ? anchorX - extent.width : anchorX,
  y:
    pivotCorner === BOTTOM_LEFT || pivotCorner === BOTTOM_RIGHT ? anchorY - extent.height : anchorY,
})

// 0x004997e0 and 0x00499710: the pivot is the corner of the quarter of the grid the anchor lies in, and the anchor moves to
// that corner of the same rectangle.
const getPivotedCursor = (cursor: BuilderCursor): BuilderCursor => {
  const isLeft = cursor.anchorX < HALF_WIDTH_CELL
  const isTop = cursor.anchorY < HALF_HEIGHT_CELL
  const pivotCorner = isLeft ? (isTop ? TOP_LEFT : BOTTOM_LEFT) : isTop ? TOP_RIGHT : BOTTOM_RIGHT
  if (pivotCorner === cursor.pivotCorner) return cursor
  const extent = getBuilderExtent(cursor.piece, cursor.orientation)
  return Object.freeze({
    ...cursor,
    pivotCorner,
    ...getAnchor(cursor.x, cursor.y, extent, pivotCorner),
  })
}

const getCursorAt = (
  cursor: BuilderCursor,
  x: number,
  y: number,
  orientation: number
): BuilderCursor =>
  Object.freeze({
    ...cursor,
    x,
    y,
    orientation,
    ...getAnchor(x, y, getBuilderExtent(cursor.piece, orientation), cursor.pivotCorner),
  })

// 0x00499890: the cursor takes a brick. A first brick sits in the middle of the grid (turned a quarter when it does not fit
// that way); when there is a cursor, it keeps its orientation (turned a quarter when the new brick would not fit) and its
// anchor, and the rectangle is pulled into the grid.
export const createBuilderCursor = (
  previous: BuilderCursor | null,
  piece: BrickPiece,
  colorIndex: number,
  setId: number
): BuilderCursor => {
  const { width, height } = piece.footprint
  if (previous === null) {
    const centredX = (BUILD_GRID_WIDTH - width) >> 1
    const centredY = (BUILD_GRID_HEIGHT - height) >> 1
    const isTurned = centredX < 0 || centredY < 0
    const x = Math.max(0, isTurned ? (BUILD_GRID_WIDTH - height) >> 1 : centredX)
    const y = Math.max(0, isTurned ? (BUILD_GRID_HEIGHT - width) >> 1 : centredY)
    const orientation = isTurned ? 1 : 0
    return getPivotedCursor({
      piece,
      colorIndex,
      setId,
      x,
      y,
      orientation,
      pivotCorner: TOP_LEFT,
      ...getAnchor(x, y, getBuilderExtent(piece, orientation), TOP_LEFT),
    })
  }
  const isQuarterTurned = (previous.orientation & 1) !== 0
  const isFitting = isQuarterTurned
    ? width <= BUILD_GRID_HEIGHT && height <= BUILD_GRID_WIDTH
    : width <= BUILD_GRID_WIDTH && height <= BUILD_GRID_HEIGHT
  const orientation = (previous.orientation + (isFitting ? 0 : 1)) & 3
  const extent = getBuilderExtent(piece, orientation)
  const topLeft = getTopLeft(previous.anchorX, previous.anchorY, extent, previous.pivotCorner)
  const x = Math.max(0, Math.min(topLeft.x, BUILD_GRID_WIDTH - extent.width))
  const y = Math.max(0, Math.min(topLeft.y, BUILD_GRID_HEIGHT - extent.height))
  return getPivotedCursor({
    piece,
    colorIndex,
    setId,
    x,
    y,
    orientation,
    pivotCorner: previous.pivotCorner,
    ...getAnchor(x, y, extent, previous.pivotCorner),
  })
}

// 0x00499cc0: a cursor put back where a placed brick was (the undo): the anchor, the orientation and the corner 0.
export const getBuilderCursorAtBrick = (
  piece: BrickPiece,
  colorIndex: number,
  setId: number,
  x: number,
  y: number,
  orientation: number
): BuilderCursor => {
  const turned = orientation & 3
  return createBuilderCursor(
    Object.freeze({
      piece,
      colorIndex,
      setId,
      x,
      y,
      orientation: turned,
      pivotCorner: TOP_LEFT,
      ...getAnchor(x, y, getBuilderExtent(piece, turned), TOP_LEFT),
    }),
    piece,
    colorIndex,
    setId
  )
}

// 0x00499b40, 0x00499b90, 0x00499bb0, 0x00499c00: one step, which stops at the grid's edge.
const getSteppedCursor = (
  cursor: BuilderCursor,
  stepX: number,
  stepY: number
): BuilderMoveResult => {
  const extent = getBuilderExtent(cursor.piece, cursor.orientation)
  const x = cursor.x + stepX
  const y = cursor.y + stepY
  const isInside =
    x >= 0 &&
    y >= 0 &&
    x + extent.width <= BUILD_GRID_WIDTH &&
    y + extent.height <= BUILD_GRID_HEIGHT
  if (!isInside) return { cursor, isMoved: false }
  return {
    cursor: getPivotedCursor(getCursorAt(cursor, x, y, cursor.orientation)),
    isMoved: true,
  }
}

// 0x00499c20 and 0x00499c60: `count` steps along one axis (the sign picks the way).
export const moveBuilderCursorAlong = (
  cursor: BuilderCursor,
  isHorizontal: boolean,
  count: number
): BuilderMoveResult => {
  const step = Math.sign(count)
  let current = cursor
  let isMoved = false
  for (let index = 0; index < Math.abs(count); index += 1) {
    const result = getSteppedCursor(current, isHorizontal ? step : 0, isHorizontal ? 0 : step)
    current = result.cursor
    isMoved = isMoved || result.isMoved
  }
  return { cursor: current, isMoved }
}

// 0x004773e0: a key's move. With both steps non-zero and `isDiagonalAtomic` the move happens only when both steps do (a
// failed first step is undone with the opposite step, as the original does); otherwise each step happens by itself.
export const moveBuilderCursor = (
  cursor: BuilderCursor,
  stepX: number,
  stepY: number,
  isDiagonalAtomic: boolean
): BuilderMoveResult => {
  if (stepX !== 0 && stepY !== 0 && isDiagonalAtomic) {
    const first = moveBuilderCursorAlong(cursor, true, stepX)
    if (first.isMoved) {
      const second = moveBuilderCursorAlong(first.cursor, false, stepY)
      if (second.isMoved) return second
    }
    return { cursor: moveBuilderCursorAlong(first.cursor, true, -stepX).cursor, isMoved: false }
  }
  const horizontal = moveBuilderCursorAlong(cursor, true, stepX)
  const vertical = moveBuilderCursorAlong(horizontal.cursor, false, stepY)
  return { cursor: vertical.cursor, isMoved: horizontal.isMoved || vertical.isMoved }
}

// 0x00499b00 and 0x00499a60: a quarter turn, or a half turn when the brick would not fit the grid turned a quarter; the
// rectangle keeps its anchor corner and is pulled into the grid.
export const rotateBuilderCursor = (cursor: BuilderCursor): BuilderCursor => {
  const isQuarterTurned = (cursor.orientation & 1) !== 0
  const { width, height } = cursor.piece.footprint
  const isFittingTurned = isQuarterTurned ? height < 7 && width < 0xb : width < 7 && height < 0xb
  const orientation = (cursor.orientation + (isFittingTurned ? 1 : 2)) & 3
  const extent = getBuilderExtent(cursor.piece, orientation)
  const topLeft = getTopLeft(cursor.anchorX, cursor.anchorY, extent, cursor.pivotCorner)
  const x = Math.max(0, Math.min(topLeft.x, BUILD_GRID_WIDTH - extent.width))
  const y = Math.max(0, Math.min(topLeft.y, BUILD_GRID_HEIGHT - extent.height))
  return getCursorAt(cursor, x, y, orientation)
}

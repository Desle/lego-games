import { findBrickPiece } from '../parse-brick-database/parse-brick-database.ts'
import {
  createBuildGrid,
  getFootprintHeight,
  getGridWithBrick,
  getPlacement,
  getRestingHeight,
  MAXIMUM_BRICK_COUNT,
} from '../build-grid/build-grid.ts'
import type {
  BrickDatabase,
  CarDesign,
  DesignProgress,
  PlacedBrick,
} from '../../types/car-builder.types.ts'

// 0x0049fb30: the builder passes 0xf, the tallest a car may be, in brick units.
export const MAXIMUM_BUILD_HEIGHT = 0xf
// A brick of a saved design, eight bytes: the piece id (16 bits, big-endian), x, y, orientation and colour (a byte each)
// and one more 16-bit value.
export const BRICK_RECORD_BYTE_COUNT = 8
// 0x0049f460 from 0x0049fb30 asks for the second variant of the piece (clamped to the last).
const DESIGN_PIECE_VARIANT = 1

const getUnsignedShort = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)

// 0x0049fb30 for one brick: it is placed when the height it would rest at leaves it within `maximumHeight`, first at the
// height its connectors give (0x0049e710 with 0), and failing that standing on the floor (with 1). A brick that does
// neither is left out.
const getDesignProgressWithBrick = (
  progress: DesignProgress,
  database: BrickDatabase,
  bytes: Uint8Array,
  offset: number,
  maximumHeight: number
): DesignProgress => {
  const piece = findBrickPiece(database, getUnsignedShort(bytes, offset), DESIGN_PIECE_VARIANT)
  if (piece === null) return progress
  const x = bytes[offset + 2] ?? 0
  const y = bytes[offset + 3] ?? 0
  const orientation = bytes[offset + 4] ?? 0
  const { footprint } = piece
  const restingHeight = getRestingHeight(progress.grid, footprint, x, y, orientation, false)
  const isWithinHeight =
    restingHeight < 0 || getFootprintHeight(footprint) + restingHeight <= maximumHeight
  if (!isWithinHeight || progress.bricks.length >= MAXIMUM_BRICK_COUNT) return progress
  const first = getPlacement(progress.grid, footprint, x, y, orientation, false)
  const placement = first.isPlaceable
    ? first
    : getPlacement(progress.grid, footprint, x, y, orientation, true)
  if (!placement.isPlaceable) return progress
  const brick: PlacedBrick = Object.freeze({
    piece,
    x,
    y,
    orientation: orientation & 3,
    colorIndex: bytes[offset + 5] ?? 0,
    unidentifiedValue: getUnsignedShort(bytes, offset + 6),
    baseHeight: placement.baseHeight,
  })
  return {
    bricks: [...progress.bricks, brick],
    grid: getGridWithBrick(progress.grid, brick, progress.bricks.length),
  }
}

// CarDesign_Load 0x0049fb30: a 16-bit count (at most 0x40, else the design is refused: null), then that many bricks.
// Each is placed on the grid as the builder would place it; one the rules refuse is dropped, so a hand-edited save
// cannot put a brick where the builder would not.
export const loadCarDesign = (
  bytes: Uint8Array,
  database: BrickDatabase,
  maximumHeight: number = MAXIMUM_BUILD_HEIGHT
): CarDesign | null => {
  const count = getUnsignedShort(bytes, 0)
  if (count > MAXIMUM_BRICK_COUNT) return null
  const empty: DesignProgress = { bricks: [], grid: createBuildGrid() }
  const loaded = Array.from({ length: count }).reduce<DesignProgress>(
    (progress, _unused, index) =>
      getDesignProgressWithBrick(
        progress,
        database,
        bytes,
        2 + index * BRICK_RECORD_BYTE_COUNT,
        maximumHeight
      ),
    empty
  )
  return Object.freeze({ bricks: Object.freeze(loaded.bricks), grid: loaded.grid })
}

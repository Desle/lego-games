import type { BrickPiece, CarDesign, PlacedBrick } from '../../types/car-builder.types.ts'
import {
  BuilderRefusal,
  CAMERA_PITCH_COUNT,
  CAMERA_YAW_COUNT,
} from '../../types/builder-session/builder-session.ts'
import type {
  BuilderCatalog,
  BuilderPlacementCheck,
  BuilderSessionMove,
  BuilderCursor,
  BuilderPlacementResult,
  BuilderSession,
} from '../../types/builder-session/builder-session.types.ts'
import {
  createBuildGrid,
  getFootprintHeight,
  getGridWithBrick,
  getOverlapCount,
  getRestingHeight,
  MAXIMUM_BRICK_COUNT,
} from '../build-grid/build-grid.ts'
import { MAXIMUM_BUILD_HEIGHT } from '../load-car-design/load-car-design.ts'
import {
  findBrickPiece,
  findBrickPieceByName,
} from '../parse-brick-database/parse-brick-database.ts'
import {
  createBuilderCursor,
  getBuilderCursorAtBrick,
  moveBuilderCursor,
  rotateBuilderCursor,
} from '../builder-cursor/builder-cursor.ts'

// The builder's own bricks start at this id; the lower ones are chassis parts (0x0049a1e0 passes `id < 0x800` as the auto
// height flag).
const FIRST_BRICK_ID = 0x800
// 0x0049f460 with 1: the variant the builder shows and the mesh uses.
const BUILDER_PIECE_VARIANT = 1
const FIRST_BRICK_INDEX = 0

const getWrapped = (value: number, count: number): number =>
  count === 0 ? 0 : ((value % count) + count) % count

const getSetBrickPiece = (catalog: BuilderCatalog, pieceId: number): BrickPiece | null =>
  findBrickPiece(catalog.database, pieceId, BUILDER_PIECE_VARIANT)

const getSelectedCursor = (
  catalog: BuilderCatalog,
  setIndex: number,
  pieceIndex: number,
  previous: BuilderCursor | null
): BuilderCursor => {
  const set = catalog.sets[setIndex]
  const brick = set?.bricks[pieceIndex]
  const piece = brick === undefined ? null : getSetBrickPiece(catalog, brick.pieceId)
  if (set === undefined || brick === undefined || piece === null) {
    throw new RangeError(`The set ${String(setIndex)} has no brick ${String(pieceIndex)}`)
  }
  return createBuilderCursor(previous, piece, brick.colorIndex, set.limit)
}

// The design a new car starts with: the set's chassis part alone, on the floor at the grid's corner (every saved design starts
// with its chassis part at (0, 0) turned 0, e.g. DEFAULT.LRS). **Hypothesis** for the chassis colour: the first brick's.
const getInitialDesign = (catalog: BuilderCatalog, setIndex: number): CarDesign => {
  const set = catalog.sets[setIndex]
  const chassisByName =
    set === undefined ? null : findBrickPieceByName(catalog.database, set.chassisName)
  const chassis =
    chassisByName === null
      ? null
      : findBrickPiece(catalog.database, chassisByName.id, BUILDER_PIECE_VARIANT)
  if (set === undefined || chassis === null) {
    throw new RangeError(`The set ${String(setIndex)} has no chassis part`)
  }
  const brick: PlacedBrick = Object.freeze({
    piece: chassis,
    x: 0,
    y: 0,
    orientation: 0,
    colorIndex: set.bricks[0]?.colorIndex ?? 0,
    unidentifiedValue: 0,
    baseHeight: 0,
  })
  return Object.freeze({
    bricks: Object.freeze([brick]),
    grid: getGridWithBrick(createBuildGrid(), brick, FIRST_BRICK_INDEX),
  })
}

// 0x004736b0 .. 0x00476ff0: the screen opens on the first set with the chassis alone and its first brick in the cursor.
export const createBuilderSession = (catalog: BuilderCatalog, setIndex = 0): BuilderSession =>
  Object.freeze({
    setIndex,
    pieceIndex: 0,
    design: getInitialDesign(catalog, setIndex),
    cursor: getSelectedCursor(catalog, setIndex, 0, null),
    cameraYaw: 0,
    cameraPitch: 0,
  })

// The set chooser (`setleft`, `setright`): another set starts a new car on its chassis. **Hypothesis**: the chooser wraps
// like the piece list (0x0049cd20) and a new set discards the bricks placed so far (a design has one chassis).
export const selectBuilderSet = (
  catalog: BuilderCatalog,
  session: BuilderSession,
  step: number
): BuilderSession =>
  createBuilderSession(catalog, getWrapped(session.setIndex + step, catalog.sets.length))

// The piece chooser (`pileft`, `piright`, 0x00477e40): the cursor takes the chosen brick of the set, keeping its place.
export const selectBuilderPiece = (
  catalog: BuilderCatalog,
  session: BuilderSession,
  step: number
): BuilderSession => {
  const count = catalog.sets[session.setIndex]?.bricks.length ?? 0
  const pieceIndex = getWrapped(session.pieceIndex + step, count)
  return Object.freeze({
    ...session,
    pieceIndex,
    cursor: getSelectedCursor(catalog, session.setIndex, pieceIndex, session.cursor),
  })
}

// 0x004773e0: moves the brick by a step the keypad direction and the view give.
export const moveBuilderSession = (
  session: BuilderSession,
  stepX: number,
  stepY: number,
  isDiagonalAtomic: boolean
): BuilderSessionMove => {
  const result = moveBuilderCursor(session.cursor, stepX, stepY, isDiagonalAtomic)
  return { session: Object.freeze({ ...session, cursor: result.cursor }), isMoved: result.isMoved }
}

// 0x00478560: a quarter turn of the brick (the rotate button).
export const rotateBuilderSession = (session: BuilderSession): BuilderSession =>
  Object.freeze({ ...session, cursor: rotateBuilderCursor(session.cursor) })

// 0x0049a1e0: where the cursor's brick would rest and why it could not.
export const getBuilderPlacement = (session: BuilderSession): BuilderPlacementCheck => {
  const { cursor, design } = session
  const { footprint } = cursor.piece
  const baseHeight = getRestingHeight(
    design.grid,
    footprint,
    cursor.x,
    cursor.y,
    cursor.orientation,
    cursor.piece.id < FIRST_BRICK_ID
  )
  if (baseHeight < 0) {
    return {
      baseHeight,
      refusal:
        baseHeight === -1 ? BuilderRefusal.NOTHING_TO_ATTACH_TO : BuilderRefusal.OUTSIDE_GRID,
    }
  }
  if (
    getOverlapCount(design.grid, footprint, cursor.x, cursor.y, cursor.orientation, baseHeight) !==
    0
  ) {
    return { baseHeight, refusal: BuilderRefusal.OVERLAPPING }
  }
  if (getFootprintHeight(footprint) + baseHeight > MAXIMUM_BUILD_HEIGHT) {
    return { baseHeight, refusal: BuilderRefusal.TOO_TALL }
  }
  if (design.bricks.length >= MAXIMUM_BRICK_COUNT) {
    return { baseHeight, refusal: BuilderRefusal.TOO_MANY_BRICKS }
  }
  return { baseHeight, refusal: null }
}

// 0x00478730 (the add button): the brick goes where it rests. **Hypothesis**: the original adds it when its drop animation
// ends (0x00477700) and the cursor then stays where it is; the port adds it at once.
export const placeBuilderBrick = (session: BuilderSession): BuilderPlacementResult => {
  const { baseHeight, refusal } = getBuilderPlacement(session)
  if (refusal !== null) return { kind: 'refused', refusal }
  const { cursor, design } = session
  const brick: PlacedBrick = Object.freeze({
    piece: cursor.piece,
    x: cursor.x,
    y: cursor.y,
    orientation: cursor.orientation,
    colorIndex: cursor.colorIndex,
    unidentifiedValue: cursor.setId,
    baseHeight,
  })
  return {
    kind: 'placed',
    session: Object.freeze({
      ...session,
      design: Object.freeze({
        bricks: Object.freeze([...design.bricks, brick]),
        grid: getGridWithBrick(design.grid, brick, design.bricks.length),
      }),
    }),
  }
}

const getDesignWithoutLastBrick = (design: CarDesign): CarDesign => {
  const bricks = design.bricks.slice(0, -1)
  return Object.freeze({
    bricks: Object.freeze(bricks),
    grid: bricks.reduce(
      (grid, brick, index) => getGridWithBrick(grid, brick, index),
      createBuildGrid()
    ),
  })
}

// 0x004787e0 (the undo button): the last brick comes off the car and into the cursor, and the choosers go to the set and the
// brick it came from. The chassis part stays (sound 0x12).
export const undoBuilderBrick = (
  catalog: BuilderCatalog,
  session: BuilderSession
): BuilderPlacementResult => {
  const last = session.design.bricks.at(-1)
  if (session.design.bricks.length <= 1 || last === undefined) {
    return { kind: 'refused', refusal: BuilderRefusal.ONLY_CHASSIS }
  }
  const foundSetIndex = catalog.sets.findIndex((set) => set.limit === last.unidentifiedValue)
  const setIndex = foundSetIndex < 0 ? session.setIndex : foundSetIndex
  const foundPieceIndex =
    catalog.sets[setIndex]?.bricks.findIndex(
      (brick) => brick.pieceId === last.piece.id && brick.colorIndex === last.colorIndex
    ) ?? -1
  return {
    kind: 'placed',
    session: Object.freeze({
      ...session,
      setIndex,
      pieceIndex: foundPieceIndex < 0 ? session.pieceIndex : foundPieceIndex,
      design: getDesignWithoutLastBrick(session.design),
      cursor: getBuilderCursorAtBrick(
        last.piece,
        last.colorIndex,
        last.unidentifiedValue,
        last.x,
        last.y,
        last.orientation
      ),
    }),
  }
}

// 0x00478080 and 0x004782f0: the view turns around the car (eight views) or rises (three heights, no wrap).
export const turnBuilderCamera = (session: BuilderSession, step: number): BuilderSession =>
  Object.freeze({ ...session, cameraYaw: getWrapped(session.cameraYaw + step, CAMERA_YAW_COUNT) })

export const raiseBuilderCamera = (session: BuilderSession, step: number): BuilderSession =>
  Object.freeze({
    ...session,
    cameraPitch: Math.max(0, Math.min(CAMERA_PITCH_COUNT - 1, session.cameraPitch + step)),
  })

// The car as the screen draws it: the placed bricks, and the cursor's brick resting where it would be placed.
export const getBuilderPreviewDesign = (session: BuilderSession): CarDesign => {
  const { cursor, design } = session
  const resting = getRestingHeight(
    design.grid,
    cursor.piece.footprint,
    cursor.x,
    cursor.y,
    cursor.orientation,
    true
  )
  const brick: PlacedBrick = Object.freeze({
    piece: cursor.piece,
    x: cursor.x,
    y: cursor.y,
    orientation: cursor.orientation,
    colorIndex: cursor.colorIndex,
    unidentifiedValue: cursor.setId,
    baseHeight: Math.max(0, resting),
  })
  return Object.freeze({ bricks: Object.freeze([...design.bricks, brick]), grid: design.grid })
}

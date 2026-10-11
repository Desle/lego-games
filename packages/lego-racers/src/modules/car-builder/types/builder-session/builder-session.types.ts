import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { BuilderRefusal as BuilderRefusalValues } from './builder-session.ts'
import type {
  BrickColor,
  BrickDatabase,
  BrickPiece,
  CarDesign,
  CarSet,
} from '../car-builder.types.ts'

export type BuilderRefusal = EnumValues<typeof BuilderRefusalValues>

// What the builder screen reads of the player's files: the brick database, the brick colours and the car sets of
// `CRSTMGR.LEB` (0x0042d730 loads them, the screen's chooser lists the sets).
export type BuilderCatalog = {
  readonly database: BrickDatabase
  readonly colors: readonly BrickColor[]
  readonly sets: readonly CarSet[]
}

// The brick the player moves over the grid (the screen's `+0x2308 + 0x28` object, built by 0x00499890). The anchor
// (`+0x04`, `+0x08`) is the corner `pivotCorner` of the brick's rectangle (0 top left, 1 bottom left, 2 top right,
// 3 bottom right); `x` and `y` are the rectangle's top left cell (`+0x18`, `+0x1c`).
export type BuilderCursor = {
  readonly piece: BrickPiece
  readonly colorIndex: number
  // The set the brick was picked from (`+0x14`); a placed brick keeps it in its unidentified value.
  readonly setId: number
  readonly x: number
  readonly y: number
  readonly orientation: number
  readonly pivotCorner: number
  readonly anchorX: number
  readonly anchorY: number
}

export type BuilderSession = {
  // Position in the catalog's sets (the set chooser) and in the set's bricks (the piece chooser).
  readonly setIndex: number
  readonly pieceIndex: number
  readonly design: CarDesign
  readonly cursor: BuilderCursor
  // The camera of the screen: 0..7 views around the car (`+0x298`) and 0..2 heights (`+0x290`).
  readonly cameraYaw: number
  readonly cameraPitch: number
}

export type BuilderPlacementResult =
  | { readonly kind: 'placed'; readonly session: BuilderSession }
  | { readonly kind: 'refused'; readonly refusal: BuilderRefusal }

export type BuilderMoveResult = {
  readonly cursor: BuilderCursor
  readonly isMoved: boolean
}

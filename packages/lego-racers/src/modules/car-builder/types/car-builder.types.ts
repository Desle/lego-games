// The footprint of a brick on the build grid (the `0x2c` pool of a brick database, read by 0x0049ea60): `width` by
// `height` cells, and for each cell two bytes, the top and the bottom. Bits 0..5 are heights in brick units (0.4 of a
// stud); the top byte's bit 7 marks a surface other bricks can attach to, the bottom byte's bit 7 a connector that
// attaches to one, and bits 6 and 7 of the bottom byte relax the overlap test (0x0049e450). Cells are stored
// column by column: cell (x, y) is pair `x · height + y`.
export type BrickFootprint = {
  readonly width: number
  readonly height: number
  // top, bottom per cell.
  readonly cells: Uint8Array
  // The two bytes after the cells, a 16-bit value (0x0049eae0): for a piece below 0x800 (a chassis part) the index of
  // the vertex that is the car's origin, 0xffff when it has none.
  readonly originVertexIndex: number
}

// One piece of a brick database (a 0x1c-byte record, read by 0x0049ee30).
export type BrickPiece = {
  readonly name: string
  // Record +0x14. Ids from 0x800 are the builder's own bricks, the lower ones are chassis parts (0x0049c6a0).
  readonly id: number
  readonly footprint: BrickFootprint
  // Record +0x16: how many face records the geometry holds; it orders the variants of one id.
  readonly faceRecordCount: number
  // Record +0x18: where the geometry starts in the face words.
  readonly geometryOffset: number
  // Records +0x0d and +0x0e: this piece's rank among the pieces of its id (sorted by face record count) and how many
  // there are.
  readonly variantIndex: number
  readonly variantCount: number
}

// The brick database (`LPieceLo.leb`, `LPieceHi.leb`, read by LegoBrickDatabase_Load 0x0049ee30).
export type BrickDatabase = {
  // Sorted by id and face record count (qsort 0x0049f430).
  readonly pieces: readonly BrickPiece[]
  // `0x28`: 16-bit face words.
  readonly faceWords: Uint16Array
  // `0x29`: three signed 16-bit values per position (divided by 256, 0x004b4948).
  readonly positions: Int16Array
  // `0x2a`: three signed bytes per normal (divided by 127, 0x004b4934).
  readonly normals: Int8Array
  // `0x2b`: two signed 16-bit values per texture coordinate (divided by 1024, 0x004b494c).
  readonly textureCoordinates: Int16Array
  // The most face records any piece needs with its studs (0x0049ee30 end, sizes of the builder's buffers): `+0x34` for
  // the builder's own bricks, `+0x38` for the chassis parts.
  readonly maximumBrickFaceCount: number
  readonly maximumPartFaceCount: number
}

// A brick colour of `L_Colors.leb` (0x00497a10): its name is a material of the brick library, and the index it keeps is
// the position in the file, which a design stores.
export type BrickColor = {
  readonly name: string
  readonly index: number
}

// A car set of the menu (`xx_cset.leb`, 0x0049cb30): the chassis it is for and the bricks it offers, each as the brick's
// name resolved to its id (0 when the name is unknown) and the colour's index (0xffffffff when unknown).
export type CarSetBrick = {
  readonly pieceName: string
  readonly pieceId: number
  readonly colorName: string
  readonly colorIndex: number
}

export type CarSet = {
  readonly chassisName: string
  // Keyword `0x2e`, an integer (set +0x08); what the menu uses it for is not traced.
  readonly limit: number
  readonly bricks: readonly CarSetBrick[]
}

// One brick of a design, as 0x0049fb30 reads it from the save: the piece, where it sits on the grid, its orientation
// (a quarter turn count, bits 0 and 1), its colour and one more 16-bit value, and the height it rests at.
export type PlacedBrick = {
  readonly piece: BrickPiece
  readonly x: number
  readonly y: number
  readonly orientation: number
  readonly colorIndex: number
  // Entry +0x08 (the second 16-bit value of the save's nine bytes); not read by the weight or the model.
  readonly unidentifiedValue: number
  // The height of the brick's base in brick units, found by 0x0049e2d0.
  readonly baseHeight: number
}

// A cell of the build grid (0x0c bytes, 0x0049df20).
export type GridCell = {
  // The index of the brick that covers it, or -1.
  readonly brickIndex: number
  // The height of the top of what covers it.
  readonly height: number
  // Whether that top takes attachments (cell +0x08).
  readonly isAttachable: boolean
}

// The grid the builder places bricks on (10 by 6 cells, 0x0049e230 from 0x00499fc0).
export type BuildGrid = {
  readonly width: number
  readonly height: number
  // Column by column, like a footprint: cell (x, y) is `x · height + y`.
  readonly cells: readonly GridCell[]
}

// The result of checking where a brick would rest (0x0049e2d0): its base height, or why it cannot.
export type PlacementResult =
  { readonly isPlaceable: true; readonly baseHeight: number } | { readonly isPlaceable: false }

// A car design: the pieces on the grid in the order the save lists them.
export type CarDesign = {
  readonly bricks: readonly PlacedBrick[]
  readonly grid: BuildGrid
}

// What 0x0049c6a0 reports for a design, which the front end writes into the racer slot (+0x14, +0x18, +0x1c, +0x20).
export type CarWeight = {
  // The number of unit cells of the builder's own bricks.
  readonly weight: number
  // The centroid's offset from the middle of the grid in x and y, and its height z.
  readonly centreOffsetX: number
  readonly centreOffsetY: number
  readonly centreHeight: number
}

// The extent of a footprint after the orientation.
export type OrientedSize = {
  readonly width: number
  readonly height: number
}

// A footprint cell's top and bottom bytes.
export type FootprintCell = {
  readonly top: number
  readonly bottom: number
}

// The sums 0x0049f560 collects over the cells of bricks: how many unit cells, and the sums of their x, y and height.
export type CellMoments = {
  readonly cellCount: number
  readonly xSum: number
  readonly ySum: number
  readonly zSum: number
}

// The bricks placed so far while a design loads, and the grid they stand on.
export type DesignProgress = {
  readonly bricks: readonly PlacedBrick[]
  readonly grid: BuildGrid
}

// One piece record of a brick database before its footprint is resolved.
export type PieceEntry = {
  readonly name: string
  readonly id: number
  readonly footprintOffset: number
  readonly faceRecordCount: number
  readonly geometryOffset: number
}

// What a brick database file holds, section by section.
export type BrickSections = {
  readonly entries: readonly PieceEntry[]
  readonly faceWords: Uint16Array
  readonly positions: Int16Array
  readonly normals: Int8Array
  readonly textureCoordinates: Int16Array
  readonly footprintPairs: Uint8Array
}

// The data of a save's blocks and the position after them.
export type LogicalBytes = {
  readonly data: Uint8Array
  readonly end: number
}

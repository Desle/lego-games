import type { SceneBitmap } from '@lego-games/lego-racers/scene'

// A printed picture of a champion's body (a logo, a number): triangles with a texture of the game, in studs.
export type BodyDecal = {
  readonly bitmap: SceneBitmap
  // x, y, z per corner, three corners per triangle.
  readonly positions: Float32Array
  // u, v per corner.
  readonly textureCoordinates: Float32Array
}

// The surface of a champion's car body model (a plain GDB model) as triangles in studs, z up, in the model's own frame
// (the vertices times the model's scale).
export type ChampionBodyFaces = {
  // x, y, z per corner, three corners per triangle: the plastic of the body, studs and decals left out.
  readonly positions: Float32Array
  // r, g, b per triangle: the colour the model gives the triangle's corners (the bricks' colours with their shading).
  readonly colors: Uint8Array
  readonly decals: readonly BodyDecal[]
}

// A grid of cells one stud wide and deep and a plate (0.4 of a stud) high; cell (x, y, z) starts at the offset plus its
// index times the cell size.
export type VoxelGrid = {
  readonly countX: number
  readonly countY: number
  readonly countZ: number
  readonly offsetX: number
  readonly offsetY: number
  readonly offsetZ: number
}

// How much of every cell the body fills (0 to 1), and the colour votes of its surface: for each cell the weight of each
// brick colour among the surfaces that lie in it.
export type BodyVoxels = {
  readonly grid: VoxelGrid
  readonly fill: Float32Array
  // Ten weights per cell, in the order of L_COLORS.LEB.
  readonly colorVotes: Float32Array
}

// A brick of the catalogue as the cells it fills when oriented, relative to its corner (oriented width, depth, height).
export type BrickTemplate = {
  readonly pieceName: string
  readonly orientation: number
  readonly countX: number
  readonly countY: number
  readonly countZ: number
  // The cells (x, y, z) the brick fills, as three numbers each.
  readonly cells: readonly number[]
}

// One brick of a champion's car as data: the catalogue piece by name, where it stands in the car's frame (grid x, y), its
// orientation (quarter turns), its colour (an index of L_COLORS.LEB) and the height of its base in plates.
export type OpponentBrick = readonly [
  pieceName: string,
  x: number,
  y: number,
  orientation: number,
  colorIndex: number,
  baseHeight: number,
]

// A champion's car rebuilt from bricks: `modelName` is the body model it stands in for.
export type OpponentCarDesign = {
  readonly modelName: string
  readonly note: string
  // Where the brick grid starts in the model's frame, in studs.
  readonly offset: readonly [number, number, number]
  readonly bricks: readonly OpponentBrick[]
  // The triangles of the body model (in the order `loadChampionBodyFaces` lists the plastic) that the bricks stand in for. The
  // others (the chassis frame, the arches, the thin fittings) stay the game's own mesh, as on a car built in the game.
  readonly coveredTriangles: readonly number[]
}

// What the fit scored the rebuilt car at, against the body (volumes in cells).
export type OpponentCarFitQuality = {
  readonly brickCount: number
  readonly bodyCellCount: number
  readonly coveredCellCount: number
  readonly extraCellCount: number
  // The share of the bricks with a surface of the body in their cells (the others take the car's main colour).
  readonly surfaceBrickRatio: number
  // The share of the body's surface, by area, that the bricks stand for (the rest stays the game's mesh).
  readonly coveredSurfaceRatio: number
}

// A plain LDraw brick or plate (see `opponent-box-parts.ts`).
export type BoxPart = {
  readonly partNumber: string
  readonly length: number
  readonly width: number
  readonly height: number
}

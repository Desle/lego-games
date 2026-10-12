import { getBrickFaces, getTriangles } from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, BrickPiece } from '@lego-games/lego-racers/car-builder'
import { BOX_PARTS, getBoxPartName } from './opponent-box-parts.ts'
import { castBodyRays, getBodyVoxels, PLATE_HEIGHT } from './body-voxels.ts'
import type { BrickTemplate, ChampionBodyFaces, VoxelGrid } from './opponent-car.types.ts'

// The catalogue pieces a car body is fitted with: boxes, slopes and wedges of the game's own brick list that have an LDraw part
// with the same shape (`ldraw-brick-mappings.ts`), the plain bricks by size and the slopes after the surfaces they cover.
export const FITTING_PIECE_NAMES: readonly string[] = Object.freeze([
  'L300100',
  'L300200',
  'L300300',
  'L300400',
  'L301000',
  'L362200',
  'SdsrtH3',
  'L303800',
  'L303900',
  'L304000',
  'L329700',
  'L329800',
  'L416100',
  'L428600',
  'L304900',
  'L656400',
  'L656500',
  'L239902',
  'L304500',
  's243200',
])

const ORIENTATION_COUNT = 4
const FOOTPRINT_HEIGHT_MASK = 0x3f
const FILL_THRESHOLD = 0.5
const TRIANGLE_CORNERS = 3

// The brick as the faces the game builds for it, in studs, in the frame of an oriented brick standing at the grid's corner.
const getPieceFaces = (
  database: BrickDatabase,
  piece: BrickPiece,
  orientation: number
): ChampionBodyFaces => {
  const faces = getBrickFaces(
    database,
    piece,
    { x: 0, y: 0, baseHeight: 0, orientation },
    0
  ).flatMap((face) => getTriangles(face))
  return {
    positions: Float32Array.from(
      faces.flatMap((triangle) =>
        triangle.flatMap((vertex) => [vertex.x, vertex.y, vertex.z * PLATE_HEIGHT])
      )
    ),
    colors: new Uint8Array(faces.length * TRIANGLE_CORNERS),
    decals: [],
  }
}

const getPieceHeight = (piece: BrickPiece): number =>
  Math.max(
    ...Array.from(
      { length: piece.footprint.width * piece.footprint.height },
      (_, index) => (piece.footprint.cells[index * 2] ?? 0) & FOOTPRINT_HEIGHT_MASK
    )
  )

// The cells a piece fills in one orientation: the cells the game's mesh fills at least half of, below the top of the footprint
// (the studs above it are not part of the shape).
const getTemplate = (database: BrickDatabase, piece: BrickPiece, orientation: number) => {
  const faces = getPieceFaces(database, piece, orientation)
  const isTurned = orientation % 2 === 1
  const grid: VoxelGrid = {
    countX: isTurned ? piece.footprint.height : piece.footprint.width,
    countY: isTurned ? piece.footprint.width : piece.footprint.height,
    countZ: getPieceHeight(piece),
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
  }
  const voxels = getBodyVoxels(faces, castBodyRays(faces.positions), grid)
  const cells: number[] = []
  for (let cellZ = 0; cellZ < grid.countZ; cellZ += 1) {
    for (let cellY = 0; cellY < grid.countY; cellY += 1) {
      for (let cellX = 0; cellX < grid.countX; cellX += 1) {
        const fill = voxels.fill[(cellZ * grid.countY + cellY) * grid.countX + cellX] ?? 0
        if (fill >= FILL_THRESHOLD) cells.push(cellX, cellY, cellZ)
      }
    }
  }
  return { grid, cells }
}

// The plain bricks and plates: oriented 0 they run along x, oriented 1 along y (a square one has one shape).
const getBoxTemplates = (): readonly BrickTemplate[] =>
  BOX_PARTS.flatMap((part) => {
    const orientations = part.length === part.width ? [0] : [0, 1]
    return orientations.map((orientation): BrickTemplate => {
      const countX = orientation === 0 ? part.length : part.width
      const countY = orientation === 0 ? part.width : part.length
      const cells = Array.from({ length: countX * countY * part.height }, (_, index) => [
        index % countX,
        Math.floor(index / countX) % countY,
        Math.floor(index / (countX * countY)),
      ]).flat()
      return {
        pieceName: getBoxPartName(part),
        orientation,
        countX,
        countY,
        countZ: part.height,
        cells: Object.freeze(cells),
      }
    })
  })

// Every named piece in every orientation that gives a different shape, and the plain bricks and plates.
export const getBrickTemplates = (
  database: BrickDatabase,
  names: readonly string[] = FITTING_PIECE_NAMES
): readonly BrickTemplate[] => {
  const templates: BrickTemplate[] = []
  for (const name of names) {
    const piece = database.pieces.find((candidate) => candidate.name === name)
    if (piece === undefined) throw new RangeError(`The brick database has no piece ${name}`)
    const seen = new Set<string>()
    for (let orientation = 0; orientation < ORIENTATION_COUNT; orientation += 1) {
      const { grid, cells } = getTemplate(database, piece, orientation)
      const key = `${String(grid.countX)}x${String(grid.countY)}:${cells.join(',')}`
      if (cells.length === 0 || seen.has(key)) continue
      seen.add(key)
      templates.push({
        pieceName: name,
        orientation,
        countX: grid.countX,
        countY: grid.countY,
        countZ: grid.countZ,
        cells: Object.freeze(cells),
      })
    }
  }
  return Object.freeze([...templates, ...getBoxTemplates()])
}

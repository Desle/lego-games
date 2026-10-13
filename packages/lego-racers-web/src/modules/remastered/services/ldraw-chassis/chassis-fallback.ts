import { getBrickFaces } from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, BrickPiece, CarVertex } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getLDrawBrickColor } from '../ldraw-car/ldraw-brick-colors.ts'
import { getFaceColorIndex, getGameBrickMaterials } from '../ldraw-car/game-brick-meshes.ts'
import type { ChassisTriangle } from './chassis-fallback.types.ts'
import { PLATE_HEIGHT, STUD_WIDTH } from '@lego-games/ldraw/building'

// A face whose flags are exactly 1 is a hidden underside (0x00497690).
const UNDERSIDE_FLAGS = 1
// A brick height unit (the z of a vertex) in LDraw units: a plate is 8, and the game's unit is 0.4 of a stud.
const BRICK_HEIGHT_UNIT = PLATE_HEIGHT
// Stands for the colour the chassis is placed in: its faces take LDraw's "current colour".
const PLACED_COLOR_INDEX = 1
const CURRENT_COLOR_CODE = 16
const STUD_SAMPLE_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-0.25, -0.25],
  [0.25, -0.25],
  [-0.25, 0.25],
  [0.25, 0.25],
]
const FLAT_TOLERANCE = 0.1
const IDENTITY_ROTATION = '1 0 0 0 1 0 0 0 1'

const formatNumber = (value: number): string => String(Number(value.toFixed(3)) + 0)

// The game's axes (x, y in studs, z up in brick units) into LDraw's (x right, y down, z toward the viewer) in LDraw units.
const getLDrawPoint = (vertex: CarVertex): readonly number[] => [
  vertex.x * STUD_WIDTH,
  -vertex.z * BRICK_HEIGHT_UNIT,
  vertex.y * STUD_WIDTH,
]

export const getChassisTriangles = (
  archive: JamArchive,
  database: BrickDatabase,
  piece: BrickPiece
): readonly ChassisTriangle[] => {
  const materials = getGameBrickMaterials(archive)
  const faces = getBrickFaces(
    database,
    piece,
    { x: 0, y: 0, baseHeight: 0, orientation: 0 },
    materials.colorMaterialIndices[PLACED_COLOR_INDEX] ?? -1
  )
  return faces
    .filter((face) => face.flags !== UNDERSIDE_FLAGS && face.vertices.length >= 3)
    .flatMap((face): readonly ChassisTriangle[] => {
      const [first, second, third, fourth] = face.vertices
      if (first === undefined || second === undefined || third === undefined) return []
      const colorIndex = getFaceColorIndex(materials, PLACED_COLOR_INDEX, face.materialIndex)
      const colorCode =
        colorIndex === PLACED_COLOR_INDEX ? CURRENT_COLOR_CODE : getLDrawBrickColor(colorIndex).code
      const corners =
        fourth === undefined
          ? [[first, second, third]]
          : [
              [first, second, third],
              [third, second, fourth],
            ]
      return corners.map((triangle) => ({ colorCode, vertices: triangle }))
    })
}

// The height (brick units) of the highest upward-facing triangle over the point, null when none lies over it.
const getTopHeight = (
  triangles: readonly ChassisTriangle[],
  x: number,
  y: number
): number | null => {
  let top: number | null = null
  for (const { vertices } of triangles) {
    const [a, b, c] = vertices
    if (a === undefined || b === undefined || c === undefined) continue
    const determinant = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
    if (determinant === 0 || determinant < 0) continue
    const first = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / determinant
    const second = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / determinant
    const third = 1 - first - second
    if (first < 0 || second < 0 || third < 0) continue
    const height = first * a.z + second * b.z + third * c.z
    if (top === null || height > top) top = height
  }
  return top
}

// Where a stud stands on the chassis: the middle of each cell of the footprint that is flat (and facing up) all around.
const getStudLines = (
  triangles: readonly ChassisTriangle[],
  piece: BrickPiece
): readonly string[] => {
  const upTriangles = triangles.filter(({ vertices }) => {
    const [a, b, c] = vertices
    if (a === undefined || b === undefined || c === undefined) return false
    const normalZ = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    return normalZ > 0
  })
  const lines: string[] = []
  for (let column = 0; column < piece.footprint.width; column += 1) {
    for (let row = 0; row < piece.footprint.height; row += 1) {
      const heights = STUD_SAMPLE_OFFSETS.map(([offsetX, offsetY]) =>
        getTopHeight(upTriangles, column + 0.5 + offsetX, row + 0.5 + offsetY)
      )
      const known = heights.filter((height): height is number => height !== null)
      if (known.length !== heights.length) continue
      const centre = known[0] ?? 0
      if (Math.max(...known) - Math.min(...known) > FLAT_TOLERANCE) continue
      const position = [
        (column + 0.5) * STUD_WIDTH,
        -centre * BRICK_HEIGHT_UNIT,
        (row + 0.5) * STUD_WIDTH,
      ]
      lines.push(
        `1 ${String(CURRENT_COLOR_CODE)} ${position.map(formatNumber).join(' ')} ${IDENTITY_ROTATION} stud.dat`
      )
    }
  }
  return lines
}

// A chassis part of the game as an unofficial LDraw part, in the chassis recipe's frame (the footprint's corner, the brick's bottom): its
// triangles, in the colour the chassis is placed in or the fixed one the game paints them, with a stud on every flat cell of its top.
// Not a model of the real thing, but a stand-in that is complete until a recipe is built from standard parts.
export const createChassisFallbackText = (
  archive: JamArchive,
  database: BrickDatabase,
  piece: BrickPiece
): string => {
  const triangles = getChassisTriangles(archive, database, piece)
  const faceLines = triangles.map(
    ({ colorCode, vertices }) =>
      `3 ${String(colorCode)} ${vertices
        .flatMap((vertex) => getLDrawPoint(vertex))
        .map(formatNumber)
        .join(' ')}`
  )
  return [
    `0 ${piece.name} (unofficial: the game's own geometry)`,
    `0 Name: ${piece.name.toLowerCase()}.dat`,
    '0 Author: lego-games',
    '0 !LDRAW_ORG Unofficial_Part',
    ...faceLines,
    ...getStudLines(triangles, piece),
  ].join('\n')
}

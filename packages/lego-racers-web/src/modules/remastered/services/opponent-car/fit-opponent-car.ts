import { BRICK_COLOR_COUNT } from './body-colors.ts'
import { castBodyRays, getBodyVoxels, PLATE_HEIGHT } from './body-voxels.ts'
import type { BodyRay } from './body-voxels.types.ts'
import { fitBodyBricks } from './brick-fit.ts'
import type {
  Candidate,
  OpponentCarFit,
  BrickTemplate,
  ChampionBodyFaces,
  OpponentBrick,
  OpponentCarDesign,
  OpponentCarFitQuality,
  VoxelGrid,
} from './opponent-car.types.ts'

// Where the grid may start relative to the stud and plate lattice: the fit tries each and keeps the best.
const HORIZONTAL_OFFSETS: readonly number[] = Object.freeze([0, 0.25, 0.5, 0.75])
const VERTICAL_OFFSETS: readonly number[] = Object.freeze([
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35,
])
const FILL_THRESHOLD = 0.5
const SURFACE_PROBE = 0.1

const getExtent = (positions: Float32Array, axis: number): readonly [number, number] => {
  let minimum = Infinity
  let maximum = -Infinity
  for (let index = axis; index < positions.length; index += 3) {
    minimum = Math.min(minimum, positions[index] ?? 0)
    maximum = Math.max(maximum, positions[index] ?? 0)
  }
  return [minimum, maximum]
}

const getGrid = (
  positions: Float32Array,
  offsetX: number,
  offsetY: number,
  offsetZ: number
): VoxelGrid => {
  const [minimumX, maximumX] = getExtent(positions, 0)
  const [minimumY, maximumY] = getExtent(positions, 1)
  const [minimumZ, maximumZ] = getExtent(positions, 2)
  const startX = Math.floor(minimumX - offsetX) + offsetX
  const startY = Math.floor(minimumY - offsetY) + offsetY
  const startZ = Math.floor((minimumZ - offsetZ) / PLATE_HEIGHT) * PLATE_HEIGHT + offsetZ
  return {
    countX: Math.ceil(maximumX - startX),
    countY: Math.ceil(maximumY - startY),
    countZ: Math.ceil((maximumZ - startZ) / PLATE_HEIGHT),
    offsetX: startX,
    offsetY: startY,
    offsetZ: startZ,
  }
}

const getBestCandidate = (
  faces: ChampionBodyFaces,
  rays: readonly BodyRay[],
  templates: readonly BrickTemplate[]
): Candidate => {
  let best: Candidate | null = null
  for (const offsetX of HORIZONTAL_OFFSETS) {
    for (const offsetY of HORIZONTAL_OFFSETS) {
      for (const offsetZ of VERTICAL_OFFSETS) {
        const voxels = getBodyVoxels(
          faces,
          rays,
          getGrid(faces.positions, offsetX, offsetY, offsetZ)
        )
        const fitted = fitBodyBricks(voxels, templates)
        if (best === null || fitted.totalGain > best.fitted.totalGain) best = { voxels, fitted }
      }
    }
  }
  if (best === null) throw new RangeError('No grid offset to fit the body on')
  return best
}

// The colour most of the bricks' cells carry, for the bricks no surface lies in.
const getFallbackColor = (candidate: Candidate): number => {
  const totals = new Float32Array(BRICK_COLOR_COUNT)
  for (const brick of candidate.fitted.bricks) {
    if (brick.colorIndex >= 0) totals[brick.colorIndex] = (totals[brick.colorIndex] ?? 0) + 1
  }
  return totals.indexOf(Math.max(...totals))
}

const getCoveredCells = (
  candidate: Candidate,
  templates: readonly BrickTemplate[]
): ReadonlySet<number> => {
  const { grid } = candidate.voxels
  const covered = new Set<number>()
  for (const brick of candidate.fitted.bricks) {
    const template = templates.find(
      (candidateTemplate) =>
        candidateTemplate.pieceName === brick.pieceName &&
        candidateTemplate.orientation === brick.orientation
    )
    for (let index = 0; template !== undefined && index < template.cells.length; index += 3) {
      const x = brick.x + (template.cells[index] ?? 0)
      const y = brick.y + (template.cells[index + 1] ?? 0)
      const z = brick.z + (template.cells[index + 2] ?? 0)
      covered.add((z * grid.countY + y) * grid.countX + x)
    }
  }
  return covered
}

// How well the bricks stand for the body, in cells of the best grid: the body's cells (at least half filled) the bricks cover,
// and the cells they fill that the body does not.
const getQuality = (
  candidate: Candidate,
  covered: ReadonlySet<number>,
  surfaceBrickRatio: number,
  coveredSurfaceRatio: number
): OpponentCarFitQuality => {
  const { voxels, fitted } = candidate
  const bodyCells = voxels.fill.reduce((count, fill) => count + (fill >= FILL_THRESHOLD ? 1 : 0), 0)
  let coveredBodyCells = 0
  for (const cell of covered) {
    if ((voxels.fill[cell] ?? 0) >= FILL_THRESHOLD) coveredBodyCells += 1
  }
  return {
    brickCount: fitted.bricks.length,
    bodyCellCount: bodyCells,
    coveredCellCount: coveredBodyCells,
    extraCellCount: covered.size - coveredBodyCells,
    surfaceBrickRatio,
    coveredSurfaceRatio,
  }
}

// The share of the body's surface, by area, in the triangles the bricks stand for.
const getCoveredSurfaceRatio = (
  faces: ChampionBodyFaces,
  coveredTriangles: readonly number[]
): number => {
  const covered = new Set(coveredTriangles)
  let coveredArea = 0
  let totalArea = 0
  for (let triangle = 0; triangle * 9 < faces.positions.length; triangle += 1) {
    const corner = (index: number, axis: number) =>
      faces.positions[triangle * 9 + index * 3 + axis] ?? 0
    const edgeOne = [0, 1, 2].map((axis) => corner(1, axis) - corner(0, axis))
    const edgeTwo = [0, 1, 2].map((axis) => corner(2, axis) - corner(0, axis))
    const area = Math.hypot(
      (edgeOne[1] ?? 0) * (edgeTwo[2] ?? 0) - (edgeOne[2] ?? 0) * (edgeTwo[1] ?? 0),
      (edgeOne[2] ?? 0) * (edgeTwo[0] ?? 0) - (edgeOne[0] ?? 0) * (edgeTwo[2] ?? 0),
      (edgeOne[0] ?? 0) * (edgeTwo[1] ?? 0) - (edgeOne[1] ?? 0) * (edgeTwo[0] ?? 0)
    )
    totalArea += area
    if (covered.has(triangle)) coveredArea += area
  }
  return coveredArea / Math.max(totalArea, 1e-9)
}

// The triangles of the body that lie in the bricks: a triangle counts when its middle, or a point just in front of or behind it,
// is in a covered cell.
const getCoveredTriangles = (
  faces: ChampionBodyFaces,
  grid: VoxelGrid,
  covered: ReadonlySet<number>
): readonly number[] => {
  const triangles: number[] = []
  const getIsCovered = (x: number, y: number, z: number): boolean => {
    const cellX = Math.floor(x - grid.offsetX)
    const cellY = Math.floor(y - grid.offsetY)
    const cellZ = Math.floor((z - grid.offsetZ) / PLATE_HEIGHT)
    return (
      cellX >= 0 &&
      cellY >= 0 &&
      cellZ >= 0 &&
      cellX < grid.countX &&
      cellY < grid.countY &&
      cellZ < grid.countZ &&
      covered.has((cellZ * grid.countY + cellY) * grid.countX + cellX)
    )
  }
  for (let triangle = 0; triangle * 9 < faces.positions.length; triangle += 1) {
    const corner = (index: number, axis: number) =>
      faces.positions[triangle * 9 + index * 3 + axis] ?? 0
    const middle = [0, 1, 2].map(
      (axis) => (corner(0, axis) + corner(1, axis) + corner(2, axis)) / 3
    )
    const edgeOne = [0, 1, 2].map((axis) => corner(1, axis) - corner(0, axis))
    const edgeTwo = [0, 1, 2].map((axis) => corner(2, axis) - corner(0, axis))
    const normal = [
      (edgeOne[1] ?? 0) * (edgeTwo[2] ?? 0) - (edgeOne[2] ?? 0) * (edgeTwo[1] ?? 0),
      (edgeOne[2] ?? 0) * (edgeTwo[0] ?? 0) - (edgeOne[0] ?? 0) * (edgeTwo[2] ?? 0),
      (edgeOne[0] ?? 0) * (edgeTwo[1] ?? 0) - (edgeOne[1] ?? 0) * (edgeTwo[0] ?? 0),
    ]
    const length = Math.hypot(...normal) || 1
    const isCovered = [-SURFACE_PROBE, 0, SURFACE_PROBE].some((distance) =>
      getIsCovered(
        (middle[0] ?? 0) + ((normal[0] ?? 0) / length) * distance,
        (middle[1] ?? 0) + ((normal[1] ?? 0) / length) * distance,
        (middle[2] ?? 0) + ((normal[2] ?? 0) / length) * distance
      )
    )
    if (isCovered) triangles.push(triangle)
  }
  return triangles
}

// A champion's car body rebuilt from catalogue bricks: the grid offset that fits best, the bricks and the colours of the surfaces
// they cover.
export const fitOpponentCar = (
  modelName: string,
  faces: ChampionBodyFaces,
  templates: readonly BrickTemplate[]
): OpponentCarFit => {
  const rays = castBodyRays(faces.positions)
  const candidate = getBestCandidate(faces, rays, templates)
  const fallbackColor = getFallbackColor(candidate)
  const covered = getCoveredCells(candidate, templates)
  const { grid } = candidate.voxels
  const bricks: readonly OpponentBrick[] = candidate.fitted.bricks.map((brick) => [
    brick.pieceName,
    brick.x,
    brick.y,
    brick.orientation,
    brick.colorIndex < 0 ? fallbackColor : brick.colorIndex,
    brick.z,
  ])
  const colored = candidate.fitted.bricks.filter((brick) => brick.colorIndex >= 0).length
  const coveredTriangles = getCoveredTriangles(faces, grid, covered)
  const design: OpponentCarDesign = {
    modelName,
    note: '',
    offset: [grid.offsetX, grid.offsetY, grid.offsetZ],
    bricks,
    coveredTriangles,
  }
  return {
    design,
    quality: getQuality(
      candidate,
      covered,
      colored / Math.max(1, bricks.length),
      getCoveredSurfaceRatio(faces, coveredTriangles)
    ),
  }
}

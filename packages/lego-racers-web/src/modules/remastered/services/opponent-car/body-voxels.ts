import { BRICK_COLOR_COUNT, getBrickColorIndex } from './body-colors.ts'
import type { BodyHit, BodyRay } from './body-voxels.types.ts'
import type { BodyVoxels, ChampionBodyFaces, VoxelGrid } from './opponent-car.types.ts'

// A stud is 1 and a plate (a brick height unit of the game) 0.4.
export const PLATE_HEIGHT = 0.4
const RAYS_PER_STUD = 8
const RAY_STEP = 1 / RAYS_PER_STUD
const RAYS_PER_CELL_FOOTPRINT = RAYS_PER_STUD * RAYS_PER_STUD
// Keeps the rays off the edges that triangles share.
const RAY_JITTER = 0.0137
const TOP_FACING_WEIGHT = 3
const TOP_FACING_NORMAL = 0.5
const COORDINATES_PER_TRIANGLE = 9

const getTriangleCorner = (positions: Float32Array, triangle: number, corner: number) => {
  const start = triangle * COORDINATES_PER_TRIANGLE + corner * 3
  return [positions[start] ?? 0, positions[start + 1] ?? 0, positions[start + 2] ?? 0] as const
}

// Where a ray straight down meets the triangle: the height of its plane there and which way the winding turns (the sign of the
// triangle's normal z), or null when the point lies outside it.
const getTriangleHit = (
  positions: Float32Array,
  triangle: number,
  x: number,
  y: number
): BodyHit | null => {
  const [ax, ay, az] = getTriangleCorner(positions, triangle, 0)
  const [bx, by, bz] = getTriangleCorner(positions, triangle, 1)
  const [cx, cy, cz] = getTriangleCorner(positions, triangle, 2)
  const determinant = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
  if (Math.abs(determinant) < 1e-9) return null
  const weightA = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / determinant
  const weightB = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / determinant
  const weightC = 1 - weightA - weightB
  if (weightA < 0 || weightB < 0 || weightC < 0) return null
  return { height: weightA * az + weightB * bz + weightC * cz, turn: Math.sign(determinant) }
}

// The body is a skin without an underside: going down a ray, a surface that faces up (outward) starts solid, one that faces down
// ends it, and a ray that never leaves the body is solid to the floor.
const getRayIntervals = (
  hits: readonly BodyHit[],
  upwardTurn: number,
  floor: number
): readonly number[] => {
  const sorted = [...hits].sort((first, second) => second.height - first.height)
  const intervals: number[] = []
  let top: number | null = null
  for (const hit of sorted) {
    if (top === null && hit.turn === upwardTurn) top = hit.height
    else if (top !== null && hit.turn !== upwardTurn) {
      intervals.push(hit.height, top)
      top = null
    }
  }
  if (top !== null) intervals.push(floor, top)
  return intervals
}

// Rays straight down through the body on a lattice of an eighth of a stud: the z ranges inside the body along each.
export const castBodyRays = (positions: Float32Array): readonly BodyRay[] => {
  const triangleCount = Math.floor(positions.length / COORDINATES_PER_TRIANGLE)
  let minimumX = Infinity
  let minimumY = Infinity
  let minimumZ = Infinity
  let maximumX = -Infinity
  let maximumY = -Infinity
  for (let index = 0; index < positions.length; index += 3) {
    minimumX = Math.min(minimumX, positions[index] ?? 0)
    maximumX = Math.max(maximumX, positions[index] ?? 0)
    minimumY = Math.min(minimumY, positions[index + 1] ?? 0)
    maximumY = Math.max(maximumY, positions[index + 1] ?? 0)
    minimumZ = Math.min(minimumZ, positions[index + 2] ?? 0)
  }
  const hitsByRay: { readonly x: number; readonly y: number; readonly hits: readonly BodyHit[] }[] =
    []
  for (let x = minimumX + RAY_JITTER; x < maximumX; x += RAY_STEP) {
    for (let y = minimumY + RAY_JITTER; y < maximumY; y += RAY_STEP) {
      const hits: BodyHit[] = []
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const hit = getTriangleHit(positions, triangle, x, y)
        if (hit !== null) hits.push(hit)
      }
      if (hits.length > 0) hitsByRay.push({ x, y, hits })
    }
  }
  // The highest surface over any point faces up, which tells which winding is outward.
  const turnVotes = hitsByRay.reduce(
    (total, ray) =>
      total + ray.hits.reduce((highest, hit) => (hit.height > highest.height ? hit : highest)).turn,
    0
  )
  const upwardTurn = turnVotes >= 0 ? 1 : -1
  return hitsByRay.map((ray) => ({
    x: ray.x,
    y: ray.y,
    intervals: getRayIntervals(ray.hits, upwardTurn, minimumZ),
  }))
}

const getCellIndex = (grid: VoxelGrid, x: number, y: number, z: number): number =>
  (z * grid.countY + y) * grid.countX + x

const getCoordinate = (value: number, offset: number, size: number) =>
  Math.floor((value - offset) / size)

const forEachFilledCell = (
  grid: VoxelGrid,
  ray: BodyRay,
  onFilled: (cell: number, amount: number) => void
) => {
  const cellX = getCoordinate(ray.x, grid.offsetX, 1)
  const cellY = getCoordinate(ray.y, grid.offsetY, 1)
  if (cellX < 0 || cellY < 0 || cellX >= grid.countX || cellY >= grid.countY) return
  for (let index = 0; index + 1 < ray.intervals.length; index += 2) {
    const low = ray.intervals[index] ?? 0
    const high = ray.intervals[index + 1] ?? 0
    const firstCell = Math.max(0, getCoordinate(low, grid.offsetZ, PLATE_HEIGHT))
    const lastCell = Math.min(grid.countZ - 1, getCoordinate(high, grid.offsetZ, PLATE_HEIGHT))
    for (let cellZ = firstCell; cellZ <= lastCell; cellZ += 1) {
      const cellLow = grid.offsetZ + cellZ * PLATE_HEIGHT
      const overlap = Math.min(high, cellLow + PLATE_HEIGHT) - Math.max(low, cellLow)
      if (overlap > 0) {
        onFilled(
          getCellIndex(grid, cellX, cellY, cellZ),
          overlap / PLATE_HEIGHT / RAYS_PER_CELL_FOOTPRINT
        )
      }
    }
  }
}

// The points of the body's surface on a lattice of an eighth of a stud, each with the brick colour its triangle stands for and
// the surface it stands for (a top counts more: it is what shows).
const forEachColorSample = (
  grid: VoxelGrid,
  faces: ChampionBodyFaces,
  onSample: (cell: number, colorIndex: number, weight: number) => void
) => {
  const triangleCount = Math.floor(faces.positions.length / COORDINATES_PER_TRIANGLE)
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const [ax, ay, az] = getTriangleCorner(faces.positions, triangle, 0)
    const [bx, by, bz] = getTriangleCorner(faces.positions, triangle, 1)
    const [cx, cy, cz] = getTriangleCorner(faces.positions, triangle, 2)
    const normalX = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    const normalY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    const normalZ = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    const area2 = Math.hypot(normalX, normalY, normalZ)
    if (area2 < 1e-9) continue
    const edge = Math.max(
      Math.hypot(bx - ax, by - ay, bz - az),
      Math.hypot(cx - ax, cy - ay, cz - az),
      Math.hypot(cx - bx, cy - by, cz - bz)
    )
    const steps = Math.max(1, Math.ceil(edge / RAY_STEP))
    const colorIndex = getBrickColorIndex(
      faces.colors[triangle * 3] ?? 0,
      faces.colors[triangle * 3 + 1] ?? 0,
      faces.colors[triangle * 3 + 2] ?? 0
    )
    const isTopFacing = Math.abs(normalZ) / area2 > TOP_FACING_NORMAL
    const weight = (area2 / 2 / (steps * steps)) * (isTopFacing ? TOP_FACING_WEIGHT : 1)
    for (let first = 0; first < steps; first += 1) {
      for (let second = 0; first + second < steps; second += 1) {
        const weightB = (first + 1 / 3) / steps
        const weightC = (second + 1 / 3) / steps
        const weightA = 1 - weightB - weightC
        const cellX = getCoordinate(weightA * ax + weightB * bx + weightC * cx, grid.offsetX, 1)
        const cellY = getCoordinate(weightA * ay + weightB * by + weightC * cy, grid.offsetY, 1)
        const cellZ = getCoordinate(
          weightA * az + weightB * bz + weightC * cz,
          grid.offsetZ,
          PLATE_HEIGHT
        )
        const isInside =
          cellX >= 0 &&
          cellY >= 0 &&
          cellZ >= 0 &&
          cellX < grid.countX &&
          cellY < grid.countY &&
          cellZ < grid.countZ
        if (isInside) onSample(getCellIndex(grid, cellX, cellY, cellZ), colorIndex, weight)
      }
    }
  }
}

// The body on a grid: how much of each cell it fills and what its surface votes the cell's colour to be.
export const getBodyVoxels = (
  faces: ChampionBodyFaces,
  rays: readonly BodyRay[],
  grid: VoxelGrid
): BodyVoxels => {
  const cellCount = grid.countX * grid.countY * grid.countZ
  const fill = new Float32Array(cellCount)
  for (const ray of rays) {
    forEachFilledCell(grid, ray, (cell, amount) => {
      fill[cell] = (fill[cell] ?? 0) + amount
    })
  }
  const colorVotes = new Float32Array(cellCount * BRICK_COLOR_COUNT)
  forEachColorSample(grid, faces, (cell, colorIndex, weight) => {
    const slot = cell * BRICK_COLOR_COUNT + colorIndex
    colorVotes[slot] = (colorVotes[slot] ?? 0) + weight
  })
  return { grid, fill, colorVotes }
}

export const getVoxelIndex = getCellIndex

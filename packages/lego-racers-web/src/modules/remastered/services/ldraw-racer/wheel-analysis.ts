import type { SceneMesh } from '@lego-games/lego-racers/scene'
import type { WheelShape } from './wheel-analysis.types.ts'

const AXIS_COUNT = 3
const CIRCULAR_TOLERANCE = 0.15
const LATERAL_AXIS_INDEX = 1
const MINIMUM_POINT_COUNT = 6
const POSITION_PRECISION = 2
// Pieces whose axes are this close in the bone's frame, and whose spans along it touch, are one wheel (a tyre and its hubcap).
const COAXIAL_TOLERANCE = 0.08

const getPositionKey = (mesh: SceneMesh, boneIndex: number, vertex: number): string =>
  [
    boneIndex,
    ...[0, 1, 2].map((axis) =>
      (mesh.positions[vertex * AXIS_COUNT + axis] ?? 0).toFixed(POSITION_PRECISION)
    ),
  ].join(',')

type Piece = {
  readonly boneIndex: number
  readonly minimum: number[]
  readonly maximum: number[]
  pointCount: number
}

const getRoot = (parents: number[], index: number): number => {
  let root = index
  while ((parents[root] ?? root) !== root) root = parents[root] ?? root
  return root
}

// The connected pieces of a skeleton model's triangles (corners that share a position, in one bone), each with its bounds in the
// frame of the bone that moves it.
const getPieces = (mesh: SceneMesh): readonly Piece[] => {
  const keyIndices = new Map<string, number>()
  const parents: number[] = []
  const boneIndices: number[] = []
  const pointOf = (vertex: number, boneIndex: number): number => {
    const key = getPositionKey(mesh, boneIndex, vertex)
    const known = keyIndices.get(key)
    if (known !== undefined) return known
    const created = parents.length
    keyIndices.set(key, created)
    parents.push(created)
    boneIndices.push(boneIndex)
    return created
  }
  const pointVertices: number[] = []
  for (const batch of mesh.drawBatches) {
    for (let corner = 0; corner + 2 < batch.vertexIndices.length; corner += 3) {
      const points = [0, 1, 2].map((offset) => {
        const vertex = batch.vertexIndices[corner + offset] ?? 0
        const point = pointOf(vertex, batch.transformIndices[corner + offset] ?? 0)
        pointVertices[point] = vertex
        return point
      })
      const root = getRoot(parents, points[0] ?? 0)
      for (const point of points.slice(1)) parents[getRoot(parents, point)] = root
    }
  }
  const pieces = new Map<number, Piece>()
  for (const [point, vertex] of pointVertices.entries()) {
    const root = getRoot(parents, point)
    const piece = pieces.get(root) ?? {
      boneIndex: boneIndices[point] ?? 0,
      minimum: [Infinity, Infinity, Infinity],
      maximum: [-Infinity, -Infinity, -Infinity],
      pointCount: 0,
    }
    pieces.set(root, piece)
    piece.pointCount += 1
    for (let axis = 0; axis < AXIS_COUNT; axis += 1) {
      const value = mesh.positions[vertex * AXIS_COUNT + axis] ?? 0
      piece.minimum[axis] = Math.min(piece.minimum[axis] ?? value, value)
      piece.maximum[axis] = Math.max(piece.maximum[axis] ?? value, value)
    }
  }
  return [...pieces.values()].filter((piece) => piece.pointCount >= MINIMUM_POINT_COUNT)
}

const getExtents = (piece: Piece): readonly number[] =>
  piece.minimum.map((minimum, axis) => (piece.maximum[axis] ?? minimum) - minimum)

const getCentre = (piece: Piece): readonly number[] =>
  piece.minimum.map((minimum, axis) => (minimum + (piece.maximum[axis] ?? minimum)) / 2)

// The axis a wheel turns about: the one whose two other extents are equal (a disc or a drum), the lateral one when several are, and
// the thinnest extent when the piece is not round.
const getAxisIndex = (extents: readonly number[]): number => {
  const circularAxes = [0, 1, 2].filter((axis) => {
    const [first = 0, second = 0] = [0, 1, 2]
      .filter((other) => other !== axis)
      .map((other) => extents[other] ?? 0)
    const larger = Math.max(first, second)
    return larger > 0 && Math.abs(first - second) / larger <= CIRCULAR_TOLERANCE
  })
  if (circularAxes.includes(LATERAL_AXIS_INDEX)) return LATERAL_AXIS_INDEX
  return circularAxes[0] ?? extents.indexOf(Math.min(...extents))
}

const getIsSameWheel = (first: WheelShape, second: WheelShape): boolean => {
  if (first.boneIndex !== second.boneIndex || first.axisIndex !== second.axisIndex) return false
  const tolerance = Math.max(first.radius, second.radius) * COAXIAL_TOLERANCE
  const getIsOnAxis = (axis: number) =>
    axis === first.axisIndex ||
    Math.abs((first.centre[axis] ?? 0) - (second.centre[axis] ?? 0)) <= tolerance
  const axialGap = Math.abs(
    (first.centre[first.axisIndex] ?? 0) - (second.centre[first.axisIndex] ?? 0)
  )
  return [0, 1, 2].every(getIsOnAxis) && axialGap <= (first.width + second.width) / 2 + tolerance
}

const mergeWheels = (first: WheelShape, second: WheelShape): WheelShape => {
  const axis = first.axisIndex
  const low = Math.min(
    (first.centre[axis] ?? 0) - first.width / 2,
    (second.centre[axis] ?? 0) - second.width / 2
  )
  const high = Math.max(
    (first.centre[axis] ?? 0) + first.width / 2,
    (second.centre[axis] ?? 0) + second.width / 2
  )
  return Object.freeze({
    ...first,
    centre: Object.freeze(
      first.centre.map((value, index) => (index === axis ? (low + high) / 2 : value))
    ),
    radius: Math.max(first.radius, second.radius),
    width: high - low,
    pointCount: first.pointCount + second.pointCount,
  })
}

// The wheels in a model of wheels: its pieces, each with the bone that moves it, its centre in that bone's frame (raw model units),
// the axis it turns about, its radius and width; a tyre and the hubcap beside it are one wheel.
export const findWheels = (mesh: SceneMesh): readonly WheelShape[] =>
  getPieces(mesh)
    .map((piece): WheelShape => {
      const extents = getExtents(piece)
      const axisIndex = getAxisIndex(extents)
      return Object.freeze({
        boneIndex: piece.boneIndex,
        centre: getCentre(piece),
        axisIndex,
        radius: Math.max(...extents.filter((_extent, axis) => axis !== axisIndex)) / 2,
        width: extents[axisIndex] ?? 0,
        pointCount: piece.pointCount,
      })
    })
    .reduce<readonly WheelShape[]>((wheels, shape) => {
      const index = wheels.findIndex((wheel) => getIsSameWheel(wheel, shape))
      if (index < 0) return [...wheels, shape]
      return wheels.map((wheel, position) =>
        position === index ? mergeWheels(wheel, shape) : wheel
      )
    }, [])

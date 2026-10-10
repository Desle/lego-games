import {
  getDotProduct as getDot,
  getNormalizedVector3,
  getStoredCrossProduct,
  getStoredDifference,
  ZERO_VECTOR3 as ORIGIN,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getIsPointInTriangle } from '../triangle-test/triangle-test.ts'
import type {
  BackFacingTriangle,
  CollisionTriangle,
  CollisionVolume,
  CollisionVolumeNode,
  QueryStackEntry,
  SegmentIntersection,
  SegmentQueryResult,
} from '../collision.types.ts'

// Child values from 0xfffe up are not nodes (CMP EAX,0xfffe / JNC).
const FIRST_MARKER_CHILD = 0xfffe

// 0x00404680 and 0x004044f0 are getDot: (a.z·b.z + a.y·b.y) + a.x·b.x, left on the FPU stack.

const getVertex = (volume: CollisionVolume, index: number): Vector3 =>
  volume.vertices[index] ?? ORIGIN

const getTriangleVertices = (
  volume: CollisionVolume,
  triangleIndex: number
): CollisionTriangle['vertices'] => {
  const indices = volume.triangles[triangleIndex]?.vertexIndices ?? [0, 0, 0]
  return Object.freeze([
    getVertex(volume, indices[0]),
    getVertex(volume, indices[1]),
    getVertex(volume, indices[2]),
  ] as const)
}

// 0x004043ae: plane distance -((v0.z·n.z + v0.y·n.y) + v0.x·n.x), stored.
const getFinishedTriangle = (
  arithmetic: FloatArithmetic,
  vertices: CollisionTriangle['vertices'],
  crossProduct: Vector3
): CollisionTriangle => {
  const normal = getNormalizedVector3(arithmetic, crossProduct)
  return Object.freeze({
    vertices,
    normal,
    planeDistance: arithmetic.storeFloat(-getDot(arithmetic, vertices[0], normal)),
  })
}

// The triangles of the node whose plane the segment crosses (0x00404204..0x00404302).
const getNodeIntersection = (
  arithmetic: FloatArithmetic,
  volume: CollisionVolume,
  node: CollisionVolumeNode,
  point: Vector3,
  direction: Vector3,
  fraction: number
): SegmentIntersection | undefined => {
  let backFacing: BackFacingTriangle | undefined
  const lastIndex = node.firstTriangleIndex + node.triangleCount
  for (let triangleIndex = node.firstTriangleIndex; triangleIndex < lastIndex; triangleIndex++) {
    const vertices = getTriangleVertices(volume, triangleIndex)
    // The record's normal stays the node's for every test; only the hit gets its own.
    const candidate: CollisionTriangle = { vertices, normal: node.normal, planeDistance: 0 }
    if (!getIsPointInTriangle(arithmetic, point, candidate)) continue
    const edgeFrom1To0 = getStoredDifference(arithmetic, vertices[0], vertices[1])
    const edgeFrom1To2 = getStoredDifference(arithmetic, vertices[2], vertices[1])
    const crossProduct = getStoredCrossProduct(arithmetic, edgeFrom1To2, edgeFrom1To0)
    if (arithmetic.getIsBelowOrEqual(getDot(arithmetic, crossProduct, direction), 0)) {
      return Object.freeze({
        point,
        triangle: getFinishedTriangle(arithmetic, vertices, crossProduct),
        materialIndex: volume.triangles[triangleIndex]?.materialIndex ?? 0,
        fraction,
      })
    }
    backFacing = { triangleIndex, crossProduct }
  }
  if (backFacing === undefined) return undefined
  return Object.freeze({
    point,
    triangle: getFinishedTriangle(
      arithmetic,
      getTriangleVertices(volume, backFacing.triangleIndex),
      backFacing.crossProduct
    ),
    materialIndex: volume.triangles[backFacing.triangleIndex]?.materialIndex ?? 0,
    fraction,
  })
}

const getPlaneVertex = (volume: CollisionVolume, node: CollisionVolumeNode): Vector3 =>
  getTriangleVertices(volume, node.firstTriangleIndex)[0]

// 0x00403fa0 (thiscall on the BVB object: start, end, triangle target, point target, material target,
// fraction target): walks the BSP front to back from the start's side and returns the first
// triangle the segment passes through, preferring one that faces the start.
export const getSegmentQueryResult = (
  arithmetic: FloatArithmetic,
  volume: CollisionVolume,
  start: Vector3,
  end: Vector3
): SegmentQueryResult => {
  const { add, divide, multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  const stack: QueryStackEntry[] = [{ nodeIndex: 0, state: 0, startDistance: 0 }]
  let lastCrossingPoint: Vector3 | undefined
  for (;;) {
    const top = stack.at(-1)
    if (top === undefined) return Object.freeze({ intersection: undefined, lastCrossingPoint })
    const node = volume.nodes[top.nodeIndex]
    if (node === undefined) return Object.freeze({ intersection: undefined, lastCrossingPoint })
    const planeVertex = getPlaneVertex(volume, node)
    if (top.state === 0) {
      const distance = getDot(
        arithmetic,
        node.normal,
        getStoredDifference(arithmetic, start, planeVertex)
      )
      stack[stack.length - 1] = { ...top, state: 1, startDistance: storeFloat(distance) }
      const child = getIsBelowOrEqual(distance, 0)
        ? node.negativeChildIndex
        : node.positiveChildIndex
      if (child < FIRST_MARKER_CHILD) stack.push({ nodeIndex: child, state: 0, startDistance: 0 })
      continue
    }
    if (top.state !== 1) {
      stack.pop()
      continue
    }
    stack[stack.length - 1] = { ...top, state: 2 }
    const endDistance = getDot(
      arithmetic,
      node.normal,
      getStoredDifference(arithmetic, end, planeVertex)
    )
    const isStartBehind = getIsBelowOrEqual(top.startDistance, 0)
    const isEndBehind = getIsBelowOrEqual(endDistance, 0)
    if (isStartBehind === isEndBehind) continue
    const startSide = isStartBehind ? -top.startDistance : top.startDistance
    const endSide = storeFloat(isStartBehind ? endDistance : -endDistance)
    const farChild = isStartBehind ? node.positiveChildIndex : node.negativeChildIndex
    const direction = getStoredDifference(arithmetic, end, start)
    const fraction = storeFloat(divide(startSide, add(startSide, endSide)))
    const point = Object.freeze({
      x: storeFloat(add(start.x, storeFloat(multiply(fraction, direction.x)))),
      y: storeFloat(add(start.y, storeFloat(multiply(direction.y, fraction)))),
      z: storeFloat(add(start.z, storeFloat(multiply(direction.z, fraction)))),
    })
    lastCrossingPoint = point
    const intersection = getNodeIntersection(arithmetic, volume, node, point, direction, fraction)
    if (intersection !== undefined) return Object.freeze({ intersection, lastCrossingPoint })
    if (farChild < FIRST_MARKER_CHILD)
      stack.push({ nodeIndex: farChild, state: 0, startDistance: 0 })
  }
}

import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type {
  CollisionTriangle,
  ProjectedPoint,
  TriangleSegmentResult,
} from '../collision.types.ts'

const getMagnitude = (arithmetic: FloatArithmetic, value: number): number =>
  arithmetic.getIsBelow(value, 0) ? -value : value

// The two coordinates kept after dropping the axis along which the normal is largest.
const getProjection = (
  arithmetic: FloatArithmetic,
  normal: Vector3
): ((vector: Vector3) => ProjectedPoint) => {
  const { getIsBelowOrEqual } = arithmetic
  const magnitudeX = getMagnitude(arithmetic, normal.x)
  const magnitudeY = getMagnitude(arithmetic, normal.y)
  const magnitudeZ = getMagnitude(arithmetic, normal.z)
  const dropX = (vector: Vector3): ProjectedPoint => ({ first: vector.y, second: vector.z })
  const dropY = (vector: Vector3): ProjectedPoint => ({ first: vector.x, second: vector.z })
  const dropZ = (vector: Vector3): ProjectedPoint => ({ first: vector.x, second: vector.y })
  if (!getIsBelowOrEqual(magnitudeX, magnitudeY)) {
    return getIsBelowOrEqual(magnitudeZ, magnitudeX) ? dropX : dropZ
  }
  return getIsBelowOrEqual(magnitudeZ, magnitudeY) ? dropY : dropZ
}

// 0x004497f0 (cdecl: point, triangle): edge tests in the plane that drops the normal's largest axis.
export const getIsPointInTriangle = (
  arithmetic: FloatArithmetic,
  point: Vector3,
  triangle: CollisionTriangle
): boolean => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const project = getProjection(arithmetic, triangle.normal)
  const [vertex0, vertex1, vertex2] = triangle.vertices.map(project)
  const projectedPoint = project(point)
  if (vertex0 === undefined || vertex1 === undefined || vertex2 === undefined) return false
  const edge20Second = storeFloat(subtract(vertex2.second, vertex0.second))
  const edge20First = storeFloat(subtract(vertex0.first, vertex2.first))
  const limit20 = storeFloat(
    add(multiply(edge20First, vertex2.second), multiply(edge20Second, vertex2.first))
  )
  const edge01Second = storeFloat(subtract(vertex0.second, vertex1.second))
  const edge01First = storeFloat(subtract(vertex1.first, vertex0.first))
  const limit01 = storeFloat(
    add(multiply(edge01First, vertex0.second), multiply(edge01Second, vertex0.first))
  )
  const edge12Second = storeFloat(subtract(vertex1.second, vertex2.second))
  const edge12First = storeFloat(subtract(vertex2.first, vertex1.first))
  const limit12 = storeFloat(
    add(multiply(edge12First, vertex1.second), multiply(edge12Second, vertex1.first))
  )
  const isClockwise = getIsBelowOrEqual(
    multiply(edge12First, edge01Second),
    multiply(edge12Second, edge01First)
  )
  const getEdgeValue = (edgeFirst: number, edgeSecond: number): number =>
    add(multiply(edgeFirst, projectedPoint.second), multiply(edgeSecond, projectedPoint.first))
  const value20 = getEdgeValue(edge20First, edge20Second)
  const value01 = getEdgeValue(edge01First, edge01Second)
  const value12 = getEdgeValue(edge12First, edge12Second)
  if (isClockwise) {
    return (
      getIsBelowOrEqual(value20, limit20) &&
      getIsBelowOrEqual(value01, limit01) &&
      getIsBelowOrEqual(value12, limit12)
    )
  }
  return (
    !getIsBelow(value20, limit20) && !getIsBelow(value01, limit01) && !getIsBelow(value12, limit12)
  )
}

const getPlaneValue = (
  arithmetic: FloatArithmetic,
  triangle: CollisionTriangle,
  point: Vector3
) => {
  const { add, multiply } = arithmetic
  const { normal } = triangle
  return add(
    add(add(multiply(normal.z, point.z), multiply(normal.y, point.y)), multiply(point.x, normal.x)),
    triangle.planeDistance
  )
}

// 0x00448b80 (cdecl: wheel, triangle): does the wheel's probe (+0x18 to +0x24) cross the triangle?
// The crossing point goes to the wheel's +0x30 before the inside test.
export const getTriangleSegmentResult = (
  arithmetic: FloatArithmetic,
  triangle: CollisionTriangle,
  start: Vector3,
  end: Vector3
): TriangleSegmentResult => {
  const { add, subtract, multiply, divide, storeFloat, getIsBelow } = arithmetic
  const startValue = getPlaneValue(arithmetic, triangle, start)
  const endValue = getPlaneValue(arithmetic, triangle, end)
  const isStartAbove = !getIsBelow(startValue, 0)
  const isEndAbove = !getIsBelow(endValue, 0)
  if (isStartAbove === isEndAbove)
    return Object.freeze({ isInside: false, crossingPoint: undefined })
  const startDistance = isStartAbove ? startValue : -startValue
  const endDistance = isStartAbove ? -endValue : endValue
  const difference = {
    x: storeFloat(subtract(end.x, start.x)),
    y: storeFloat(subtract(end.y, start.y)),
    z: storeFloat(subtract(end.z, start.z)),
  }
  const fraction = divide(startDistance, add(endDistance, startDistance))
  const offsetX = storeFloat(multiply(fraction, difference.x))
  const offsetY = storeFloat(multiply(difference.y, fraction))
  const offsetZ = multiply(fraction, difference.z)
  const crossingPoint = Object.freeze({
    x: storeFloat(add(offsetX, start.x)),
    y: storeFloat(add(offsetY, start.y)),
    z: storeFloat(add(offsetZ, start.z)),
  })
  return Object.freeze({
    isInside: getIsPointInTriangle(arithmetic, crossingPoint, triangle),
    crossingPoint,
  })
}

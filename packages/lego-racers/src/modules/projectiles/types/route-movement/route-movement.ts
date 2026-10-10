import type { GroundQuery } from '../../../power-ups/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { RouteNode } from './route-movement.types.ts'

// 0x004b1a70: a warping racer travels this many units per millisecond.
export const WARP_UNITS_PER_MILLISECOND = Math.fround(0.6)
// 0x004b0170 and 0x004b0268: the landing probe runs from 5 above the racer to 50 below it, and the racer is put 5
// above whatever it hits.
const LANDING_HEIGHT = 5
const LANDING_PROBE_DEPTH = 50
// 0x004b1aa0..: the car body slot 8 pull the racer is given when it lands.
export const LANDING_SPEED = 700

// 0x0041eaf0 (thiscall on the route; position, distance, first node): the position travels the distance along the
// polyline of the route's nodes, snapping to each node it passes.
export const getPointMovedAlongRoute = (
  arithmetic: FloatArithmetic,
  route: readonly RouteNode[],
  position: Vector3,
  distance: number,
  firstNodeIndex: number | null
): Vector3 => {
  const { add, subtract, multiply, divide, getSquareRoot, storeFloat, getIsBelow } = arithmetic
  let current = position
  let remaining = distance
  let nodeIndex = firstNodeIndex ?? 0
  if (route.length === 0) return position
  while (!arithmetic.getIsBelowOrEqual(remaining, 0)) {
    const node = route[nodeIndex]
    if (node === undefined) return current
    const differenceX = subtract(current.x, node.position.x)
    const differenceY = subtract(current.y, node.position.y)
    const differenceZ = subtract(current.z, node.position.z)
    const length = getSquareRoot(
      add(
        add(multiply(differenceZ, differenceZ), multiply(differenceY, differenceY)),
        multiply(differenceX, differenceX)
      )
    )
    if (getIsBelow(length, remaining)) {
      remaining = subtract(remaining, length)
      current = node.position
    } else {
      const towardX = subtract(node.position.x, current.x)
      const towardY = storeFloat(subtract(node.position.y, current.y))
      const towardZ = storeFloat(subtract(node.position.z, current.z))
      const unitY = storeFloat(divide(towardY, length))
      const unitZ = storeFloat(divide(towardZ, length))
      current = Object.freeze({
        x: storeFloat(add(multiply(divide(towardX, length), remaining), current.x)),
        y: storeFloat(add(multiply(unitY, remaining), current.y)),
        z: storeFloat(add(multiply(unitZ, remaining), current.z)),
      })
      remaining = 0
    }
    nodeIndex = node.nextIndex
  }
  return current
}

// 0x0045e080: where a warp puts the racer down: 5 above the ground under it, or 5 above where it is.
export const getWarpLandingPosition = (
  arithmetic: FloatArithmetic,
  position: Vector3,
  getGroundPoint: GroundQuery
): Vector3 => {
  const { add, subtract, storeFloat } = arithmetic
  const hit = getGroundPoint(
    Object.freeze({ ...position, z: storeFloat(add(position.z, LANDING_HEIGHT)) }),
    Object.freeze({ ...position, z: storeFloat(subtract(position.z, LANDING_PROBE_DEPTH)) })
  )
  const ground = hit ?? position
  return Object.freeze({ ...ground, z: storeFloat(add(ground.z, LANDING_HEIGHT)) })
}

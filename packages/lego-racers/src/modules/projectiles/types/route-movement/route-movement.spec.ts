import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { getPointMovedAlongRoute, getWarpLandingPosition } from './route-movement.ts'
import type { RouteNode } from './route-movement.types.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }

const getNode = (x: number, y: number, nextIndex: number): RouteNode => ({
  normal: { x: 0, y: 1, z: 0 },
  planeOffset: 0,
  position: { x, y, z: 0 },
  nextIndex,
})

// A square: (0,10) -> (10,10) -> (10,0) -> (0,0), then round again.
const ROUTE: readonly RouteNode[] = [
  getNode(0, 10, 1),
  getNode(10, 10, 2),
  getNode(10, 0, 3),
  getNode(0, 0, 0),
]

describe('getPointMovedAlongRoute (0x0041eaf0)', () => {
  it('moves straight to the first node when the distance is short', () => {
    // Arrange / Act
    const moved = getPointMovedAlongRoute(SINGLE, ROUTE, ORIGIN, 4, 0)

    // Assert
    expect(moved).toEqual({ x: 0, y: 4, z: 0 })
  })

  it('snaps to each node it passes and carries the rest of the distance on', () => {
    // Arrange / Act
    const moved = getPointMovedAlongRoute(SINGLE, ROUTE, ORIGIN, 15, 0)

    // Assert: 10 to (0,10), then 5 along to (5,10).
    expect(moved).toEqual({ x: 5, y: 10, z: 0 })
  })

  it('starts at the first node when no node is given and goes round the route', () => {
    // Arrange / Act
    const moved = getPointMovedAlongRoute(SINGLE, ROUTE, ORIGIN, 45, null)

    // Assert: (0,10), (10,10), (10,0), (0,0) are 10 + 10 + 10 + 10 = 40, then 5 more along to (0,5).
    expect(moved).toEqual({ x: 0, y: 5, z: 0 })
  })

  it('does not move for a distance that is not positive or on an empty route', () => {
    // Arrange / Act
    const results = [
      getPointMovedAlongRoute(SINGLE, ROUTE, ORIGIN, 0, 0),
      getPointMovedAlongRoute(SINGLE, ROUTE, ORIGIN, -3, 0),
      getPointMovedAlongRoute(SINGLE, [], ORIGIN, 9, 0),
    ]

    // Assert
    expect(results).toEqual([ORIGIN, ORIGIN, ORIGIN])
  })
})

describe('getWarpLandingPosition (0x0045e080)', () => {
  it('puts the racer 5 above the ground under it', () => {
    // Arrange
    const ground = () => ({ x: 3, y: 4, z: -20 })

    // Act
    const landing = getWarpLandingPosition(SINGLE, { x: 3, y: 4, z: 10 }, ground)

    // Assert
    expect(landing).toEqual({ x: 3, y: 4, z: -15 })
  })

  it('puts the racer 5 above where it is when the probe finds nothing', () => {
    // Arrange / Act
    const landing = getWarpLandingPosition(SINGLE, { x: 3, y: 4, z: 10 }, () => null)

    // Assert
    expect(landing).toEqual({ x: 3, y: 4, z: 15 })
  })
})

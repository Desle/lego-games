import { createDecalFrame, projectDecal } from '../../../decal/index.ts'
import type { DecalTriangle, DecalVertex, DecalWorld } from '../../../decal/index.ts'
import {
  createFloatArithmetic,
  getFloatFromBits,
  getTruncatedInteger,
  RACE_FPU_PRECISION,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type {
  SkidTrail,
  SkidTrailAllocation,
  SkidTrailMesh,
  SkidTrailPool,
  SkidTrailRequest,
} from '../../types/skid-trail.types.ts'

const { add, subtract, multiply, divide, getSquareRoot, storeFloat, getIsBelow } =
  createFloatArithmetic(RACE_FPU_PRECISION)

export const SKID_TRAIL_COUNT = 4
const RING_SIZE = 3
const MAXIMUM_TRIANGLES = 12
// 0x004b4784 (0.1): a wheel that moved less does not change the stretch.
const MINIMUM_DISTANCE = getFloatFromBits(0x3dcccccd)
// 0x004b4780 (0.25) scales the width into the squared distance within which a new stretch joins the last one.
const JOIN_SCALE = getFloatFromBits(0x3e800000)
// 0x004b4778 (15) and 0x004b477c (6): how deep the decal's box reaches and how high above the wheels it starts.
const DEPTH = getFloatFromBits(0x41700000)
const LIFT = getFloatFromBits(0x40c00000)
const HALF = getFloatFromBits(0x3f000000)
// 0x004af388 and 0x004b09c0.
const ONE = getFloatFromBits(0x3f800000)
const FULL_ALPHA_FLOAT = getFloatFromBits(0x437f0000)
const FULL_ALPHA = 0xff
const NORMAL: Vector3 = Object.freeze({ x: 0, y: 0, z: -1 })
const LONG_TRAIL = 1000
const SHORT_TRAIL = 250

const createTrail = (): SkidTrail =>
  Object.freeze({
    isActive: false,
    isFading: false,
    isRingFull: false,
    isWaitingForFirstPoint: false,
    isDirty: false,
    isShowingLive: false,
    durationMilliseconds: 0,
    segmentMilliseconds: 0,
    elapsedMilliseconds: 0,
    ringIndex: 0,
    width: 0,
    alpha: FULL_ALPHA,
    baseAlpha: ONE,
    previousPoint: ZERO_VECTOR3,
    currentPoint: ZERO_VECTOR3,
    frame: null,
    live: Object.freeze([]),
    ring: Object.freeze([]),
    racerIndex: -1,
  })

export const createSkidTrailPool = (): SkidTrailPool =>
  Object.freeze({ trails: Object.freeze(Array.from({ length: SKID_TRAIL_COUNT }, createTrail)) })

export const getSkidTrailKind = (isSpinning: boolean): number =>
  isSpinning ? SHORT_TRAIL : LONG_TRAIL

const getPoolWithTrail = (pool: SkidTrailPool, index: number, trail: SkidTrail): SkidTrailPool =>
  Object.freeze({
    trails: Object.freeze(pool.trails.map((current, at) => (at === index ? trail : current))),
  })

// 0x004927c0 and 0x00491d90: the first free trail starts a trail of `kind` milliseconds (the stretch lasts a quarter, and
// the duration is a whole number of quarters); null for none free. The pool, the trail's index and the trail come back.
export const allocateSkidTrail = (
  pool: SkidTrailPool,
  kind: number,
  request: SkidTrailRequest
): SkidTrailAllocation => {
  const index = pool.trails.findIndex((trail) => !trail.isActive)
  if (index === -1) return { pool, index: null }
  const segmentMilliseconds = Math.floor(kind / 4)
  const trail: SkidTrail = Object.freeze({
    ...createTrail(),
    isActive: true,
    isWaitingForFirstPoint: true,
    durationMilliseconds: segmentMilliseconds * 4,
    segmentMilliseconds,
    width: request.width,
    baseAlpha: request.baseAlpha,
    racerIndex: request.racerIndex,
  })
  return { pool: getPoolWithTrail(pool, index, trail), index }
}

// 0x00492820 and 0x00491de0: the trail starts to fade over `fadeMilliseconds` (0 ends it at the next step).
export const releaseSkidTrail = (
  pool: SkidTrailPool,
  index: number,
  fadeMilliseconds: number
): SkidTrailPool => {
  const trail = pool.trails[index]
  if (trail === undefined) return pool
  return getPoolWithTrail(
    pool,
    index,
    Object.freeze({
      ...trail,
      isFading: true,
      elapsedMilliseconds: 0,
      durationMilliseconds: fadeMilliseconds,
    })
  )
}

// 0x00491fa0 (trail, milliseconds, point): the first point only starts the stretch. Later ones add the time; a wheel that
// moved at least 0.1 puts the decal's box between the last point and this one, 6 above their middle, as wide as the
// mark and as long as the distance, and marks the stretch as changed.
export const addSkidTrailPoint = (
  pool: SkidTrailPool,
  index: number,
  point: Vector3,
  elapsedMilliseconds: number
): SkidTrailPool => {
  const trail = pool.trails[index]
  if (trail === undefined) return pool
  if (trail.isWaitingForFirstPoint) {
    return getPoolWithTrail(
      pool,
      index,
      Object.freeze({
        ...trail,
        currentPoint: point,
        previousPoint: point,
        isWaitingForFirstPoint: false,
      })
    )
  }
  const elapsed = trail.elapsedMilliseconds + elapsedMilliseconds
  const moved = {
    x: subtract(point.x, trail.previousPoint.x),
    y: subtract(point.y, trail.previousPoint.y),
    z: subtract(point.z, trail.previousPoint.z),
  }
  const length = getSquareRoot(
    add(add(multiply(moved.z, moved.z), multiply(moved.y, moved.y)), multiply(moved.x, moved.x))
  )
  const advanced: SkidTrail = Object.freeze({
    ...trail,
    currentPoint: point,
    elapsedMilliseconds: elapsed,
  })
  if (getIsBelow(length, MINIMUM_DISTANCE)) return getPoolWithTrail(pool, index, advanced)
  const direction: Vector3 = Object.freeze({
    x: storeFloat(divide(moved.x, length)),
    y: storeFloat(divide(moved.y, length)),
    z: storeFloat(divide(moved.z, length)),
  })
  const centre: Vector3 = Object.freeze({
    x: storeFloat(multiply(add(point.x, trail.previousPoint.x), HALF)),
    y: storeFloat(multiply(add(point.y, trail.previousPoint.y), HALF)),
    z: storeFloat(subtract(multiply(add(point.z, trail.previousPoint.z), HALF), -LIFT)),
  })
  const frame = createDecalFrame({
    position: centre,
    normal: NORMAL,
    upHint: direction,
    width: trail.width,
    height: storeFloat(length),
    depth: DEPTH,
  })
  return getPoolWithTrail(pool, index, Object.freeze({ ...advanced, frame, isDirty: true }))
}

const getVertices = (triangles: readonly DecalTriangle[]): readonly DecalVertex[] =>
  triangles.flatMap((triangle) => [...triangle])

const getTrianglesOf = (vertices: readonly DecalVertex[]): readonly DecalTriangle[] =>
  Array.from({ length: Math.floor(vertices.length / 3) }, (_, at) =>
    Object.freeze([
      vertices[at * 3] as DecalVertex,
      vertices[at * 3 + 1] as DecalVertex,
      vertices[at * 3 + 2] as DecalVertex,
    ] as const)
  )

// 0x00492470: the stretch in progress joins the last finished one: each of its corners that lies within a quarter of the
// width (squared distance) of a corner of the finished stretch moves onto it, the finished corners taken in order.
const getJoinedTriangles = (
  trail: SkidTrail,
  live: readonly DecalTriangle[]
): readonly DecalTriangle[] => {
  if (trail.ringIndex === 0 && !trail.isRingFull) return live
  const previous = trail.ring[trail.ringIndex > 0 ? trail.ringIndex - 1 : RING_SIZE - 1]
  if (previous === undefined) return live
  const limit = storeFloat(multiply(trail.width, JOIN_SCALE))
  const corners = [...getVertices(live)]
  for (const finished of getVertices(previous)) {
    corners.forEach((corner, at) => {
      const x = subtract(corner.x, finished.x)
      const y = subtract(corner.y, finished.y)
      const z = subtract(corner.z, finished.z)
      const squared = add(add(multiply(z, z), multiply(y, y)), multiply(x, x))
      if (getIsBelow(squared, limit)) {
        corners[at] = Object.freeze({ ...corner, x: finished.x, y: finished.y, z: finished.z })
      }
    })
  }
  return getTrianglesOf(corners)
}

const getProjected = (world: DecalWorld, trail: SkidTrail): readonly DecalTriangle[] =>
  trail.frame === null
    ? trail.live
    : projectDecal(world, trail.frame, { maximumTriangles: MAXIMUM_TRIANGLES })

// 0x00491e20 (trail, milliseconds): a fading trail takes the time and its alpha, and ends when the fade has run. A trail in
// use shows the stretch that changed, joined to the last one; when the stretch has lasted longer than a quarter it
// is finished into the ring, and the next one starts where this one ended.
const getSteppedTrail = (
  world: DecalWorld,
  trail: SkidTrail,
  elapsedMilliseconds: number
): SkidTrail => {
  if (!trail.isActive) return trail
  if (trail.isFading) {
    const elapsed = trail.elapsedMilliseconds + elapsedMilliseconds
    if (elapsed >= trail.durationMilliseconds) {
      return Object.freeze({
        ...trail,
        elapsedMilliseconds: elapsed,
        isActive: false,
        isFading: false,
      })
    }
    const alpha = getTruncatedInteger(
      multiply(
        multiply(subtract(ONE, divide(elapsed, trail.durationMilliseconds)), FULL_ALPHA_FLOAT),
        trail.baseAlpha
      )
    )
    return Object.freeze({ ...trail, elapsedMilliseconds: elapsed, alpha })
  }
  if (!trail.isDirty) return Object.freeze({ ...trail, isShowingLive: false })
  const live = getJoinedTriangles(trail, getProjected(world, trail))
  const shown: SkidTrail = Object.freeze({ ...trail, live, isShowingLive: true, isDirty: false })
  if (!(trail.elapsedMilliseconds > trail.segmentMilliseconds)) return shown
  const ring = Array.from({ length: RING_SIZE }, (_, at) =>
    at === trail.ringIndex ? live : (trail.ring[at] ?? Object.freeze([]))
  )
  const next = trail.ringIndex + 1
  return Object.freeze({
    ...shown,
    ring: Object.freeze(ring),
    ringIndex: next === RING_SIZE ? 0 : next,
    isRingFull: trail.isRingFull || next === RING_SIZE,
    previousPoint: trail.currentPoint,
    elapsedMilliseconds: 0,
    isShowingLive: false,
  })
}

// 0x00492870: every trail in use takes the milliseconds.
export const stepSkidTrailPool = (
  pool: SkidTrailPool,
  world: DecalWorld,
  elapsedMilliseconds: number
): SkidTrailPool =>
  Object.freeze({
    trails: Object.freeze(
      pool.trails.map((trail) => getSteppedTrail(world, trail, elapsedMilliseconds))
    ),
  })

// 0x00492180: what a trail in use draws: the finished stretches (all three once the ring is full, else the ones
// made) and the stretch in progress, under the alpha of a fade (below 255).
export const getSkidTrailMeshes = (pool: SkidTrailPool): readonly SkidTrailMesh[] =>
  pool.trails.flatMap((trail) =>
    trail.isActive
      ? [
          Object.freeze({
            racerIndex: trail.racerIndex,
            alpha: trail.alpha,
            triangles: Object.freeze([
              ...(trail.isShowingLive ? trail.live : []),
              ...trail.ring
                .slice(0, trail.isRingFull ? RING_SIZE : trail.ringIndex)
                .flatMap((stretch) => stretch),
            ]),
          }),
        ]
      : []
  )

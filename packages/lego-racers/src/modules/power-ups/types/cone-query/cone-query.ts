import {
  getNormalizedVector3,
  type FloatArithmetic,
  type Vector3,
} from '../../../simulation-math/index.ts'
import { findNearestRacerInCone } from '../../../racer-ai/index.ts'
import type { ConeQuery, ConeQueryWindow } from '../power-ups.types.ts'

// 0x004b1840, 0x004b1844, 0x004b1848: the cannon's racer target (0x0045aa30).
export const CANNON_RACER_WINDOW: ConeQueryWindow = Object.freeze({
  minimumDistanceSquared: 100,
  maximumDistanceSquared: 160000,
  minimumCosine: Math.fround(0.9),
})
// 0x004b1840, 0x004b1844, 0x004b184c: track targets (TGB) for the cannon and the grapple.
export const TRACK_TARGET_WINDOW: ConeQueryWindow = Object.freeze({
  minimumDistanceSquared: 100,
  maximumDistanceSquared: 160000,
  minimumCosine: Math.fround(0.95),
})
// 0x004b185c, 0x004b1860, 0x004b1868: the grapple's farthest racer (0x0043c910).
export const GRAPPLE_FARTHEST_WINDOW: ConeQueryWindow = Object.freeze({
  minimumDistanceSquared: 100,
  maximumDistanceSquared: 62500,
  minimumCosine: Math.fround(0.93),
})
// 0x004b185c, 0x004b1864, 0x004b186c: the grapple's nearest racer.
export const GRAPPLE_NEAREST_WINDOW: ConeQueryWindow = Object.freeze({
  minimumDistanceSquared: 100,
  maximumDistanceSquared: 160000,
  minimumCosine: Math.fround(0.6),
})
// 0x004b1850, 0x004b1854, 0x004b1858: the barrel's throw target (0x0045ad30).
export const BARREL_WINDOW: ConeQueryWindow = Object.freeze({
  minimumDistanceSquared: 100,
  maximumDistanceSquared: 160000,
  minimumCosine: Math.fround(0.9),
})

// One candidate of 0x0043ca60 / 0x0043c910 / 0x0043c6e0 / 0x0043c7f0 / 0x0045c6a0 (identical x87 sequences).
const getDistanceSquaredInCone = (
  arithmetic: FloatArithmetic,
  query: ConeQuery,
  target: Vector3
): number | null => {
  const { origin, direction, window } = query
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  // FSUB kept on the stack; the y and z differences are also stored (FST float).
  const differenceX = subtract(target.x, origin.x)
  const differenceY = subtract(target.y, origin.y)
  const differenceZ = subtract(target.z, origin.z)
  const distanceSquared = storeFloat(
    add(
      add(multiply(differenceZ, differenceZ), multiply(differenceY, differenceY)),
      multiply(differenceX, differenceX)
    )
  )
  if (getIsBelow(distanceSquared, window.minimumDistanceSquared)) return null
  if (!getIsBelowOrEqual(distanceSquared, window.maximumDistanceSquared)) return null
  const unit = getNormalizedVector3(
    arithmetic,
    Object.freeze({
      x: storeFloat(differenceX),
      y: storeFloat(differenceY),
      z: storeFloat(differenceZ),
    })
  )
  const cosine = add(
    add(multiply(direction.z, unit.z), multiply(direction.y, unit.y)),
    multiply(unit.x, direction.x)
  )
  if (getIsBelow(cosine, window.minimumCosine)) return null
  return distanceSquared
}

// 0x0043ca60 (racers) and 0x0045c6a0 (track targets) run the same x87 sequence: racer-ai's port, or -1.
export const getNearestInCone = (arithmetic: FloatArithmetic, query: ConeQuery): number =>
  findNearestRacerInCone(arithmetic, {
    racerPositions: query.targets.map((target) => target.position),
    origin: query.origin,
    direction: query.direction,
    minimumDistanceSquared: query.window.minimumDistanceSquared,
    maximumDistanceSquared: query.window.maximumDistanceSquared,
    minimumCosine: query.window.minimumCosine,
  }) ?? -1

// 0x0043c910: the farthest racer in the cone, or -1 (the running best starts at 0.0).
export const getFarthestInCone = (arithmetic: FloatArithmetic, query: ConeQuery): number =>
  query.targets.reduce(
    (best, target, index) => {
      const distanceSquared = getDistanceSquaredInCone(arithmetic, query, target.position)
      if (
        distanceSquared === null ||
        !arithmetic.getIsBelow(best.distanceSquared, distanceSquared)
      ) {
        return best
      }
      return { index, distanceSquared }
    },
    { index: -1, distanceSquared: 0 }
  ).index

// 0x0043c6e0 (afterIndex -1) and 0x0043c7f0: the first racer after afterIndex in the cone, or -1.
export const getNextInCone = (
  arithmetic: FloatArithmetic,
  query: ConeQuery,
  afterIndex: number
): number =>
  query.targets.findIndex(
    (target, index) =>
      index > afterIndex && getDistanceSquaredInCone(arithmetic, query, target.position) !== null
  )

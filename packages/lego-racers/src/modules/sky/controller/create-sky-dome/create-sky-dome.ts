import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import {
  FULL_TURN,
  NEGATIVE_QUARTER_TURN,
  QUARTER_TURN,
  SKY_DOME_RADIUS,
  SKY_DOME_SEGMENT_COUNT,
} from '../../types/sky-constants/sky-constants.ts'
import type { SkyDome, SkyDomeParameters } from '../../types/sky.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// The rings of a hemisphere: 1 - truncate((-π/2) / step) (0x00490823..0x00490831, `_ftol` truncates).
const getRingCount = (step: number): number =>
  1 - Math.trunc(arithmetic.divide(NEGATIVE_QUARTER_TURN, step))

// Latitude of each ring, measured from the pole: step, 2·step, ..., with the last ring on the equator
// (0x004909a3 stores the literal π/2).
const getLatitudes = (ringCount: number, step: number): readonly number[] => {
  const latitudes: number[] = []
  let latitude = step
  for (let ring = 0; ring < ringCount; ring++) {
    latitudes.push(ring === ringCount - 1 ? QUARTER_TURN : latitude)
    latitude = arithmetic.storeFloat(arithmetic.add(latitude, step))
  }
  return latitudes
}

// Vertices of one ring at height `cos(latitude)·radius` and horizontal radius `sin(latitude)·radius`, walking the
// longitude from 0 by `step` (0x004909ab..0x00490a8e); the centre is the origin.
const getRingPositions = (
  latitude: number,
  radius: number,
  segmentCount: number,
  step: number
): readonly number[] => {
  const height = arithmetic.storeFloat(arithmetic.multiply(arithmetic.getCosine(latitude), radius))
  const ringRadius = arithmetic.storeFloat(
    arithmetic.multiply(arithmetic.getSine(latitude), radius)
  )
  const positions: number[] = []
  let longitude = 0
  for (let segment = 0; segment < segmentCount; segment++) {
    positions.push(
      arithmetic.storeFloat(arithmetic.multiply(arithmetic.getCosine(longitude), ringRadius)),
      arithmetic.storeFloat(arithmetic.multiply(arithmetic.getSine(longitude), ringRadius)),
      height
    )
    longitude = arithmetic.storeFloat(arithmetic.add(longitude, step))
  }
  return positions
}

// The two triangles between ring `ring - 1` and `ring` for each segment (0x00490ebf..0x00491091): the face bytes are
// (v, next + n, v + n) and (v, next, next + n), where `next` wraps to the start of the segment's ring.
const getRingTriangleCorners = (ring: number, segmentCount: number): readonly number[] => {
  const first = (ring - 1) * segmentCount
  return Array.from({ length: segmentCount }, (_unused, segment) => {
    const vertex = first + segment
    const next = segment === segmentCount - 1 ? first : vertex + 1
    return [
      vertex,
      next + segmentCount,
      vertex + segmentCount,
      vertex,
      next,
      next + segmentCount,
    ] as const
  }).flat()
}

// The sphere builder 0x004907f0 as `Sky_Load` calls it: a hemisphere (flag 1) with neither the top nor the bottom
// cap, centred on the origin, in the vertex colour format. Normals, caps and full spheres are not ported.
export const createSkyDome = (
  parameters: SkyDomeParameters = Object.freeze({
    radius: SKY_DOME_RADIUS,
    segmentCount: SKY_DOME_SEGMENT_COUNT,
  })
): SkyDome => {
  const { radius, segmentCount } = parameters
  const step = arithmetic.storeFloat(arithmetic.divide(FULL_TURN, segmentCount))
  const ringCount = getRingCount(step)
  const positions = getLatitudes(ringCount, step).flatMap((latitude) =>
    getRingPositions(latitude, radius, segmentCount, step)
  )
  const triangleCorners = Array.from({ length: ringCount - 1 }, (_unused, index) =>
    getRingTriangleCorners(index + 1, segmentCount)
  ).flat()
  return Object.freeze({
    ringCount,
    segmentCount,
    vertexCount: ringCount * segmentCount,
    positions: new Float32Array(positions),
    triangleCorners: new Uint16Array(triangleCorners),
  })
}

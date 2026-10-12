import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { DecalPolygonVertex } from '../../types/decal.types.ts'
import { DECAL_EDGE, getDecalCodeFromV } from './decal-mapping.ts'
import type { DecalClipStage } from './clip-decal-polygon.types.ts'

const { add, subtract, multiply, divide, storeFloat } = createFloatArithmetic(RACE_FPU_PRECISION)

const ONE = 1

// (current - previous) * fraction + previous, each result stored as a float.
const interpolate = (previous: number, current: number, fraction: number): number =>
  storeFloat(add(multiply(subtract(current, previous), fraction), previous))

const getInterpolatedPosition = (
  previous: DecalPolygonVertex,
  current: DecalPolygonVertex,
  fraction: number
) => ({
  x: interpolate(previous.x, current.x, fraction),
  y: interpolate(previous.y, current.y, fraction),
  z: interpolate(previous.z, current.z, fraction),
})

// The four stages of 0x00414f40, in order: the edges u = 0 (out-code bit 1), u = 1 (bit 2), v = 0 (bit 4) and
// v = 1 (bit 8). A vertex made on an edge gets the edge's value for the coordinate it fixes, except on the far edges
// where the engine writes 0.99 (0x004af920) although the point lies on 1; u edges give it an out-code from v alone,
// v edges a zero one.
const STAGES: readonly DecalClipStage[] = [
  {
    bit: 1,
    getFraction: (previous, current) => divide(previous.u, subtract(previous.u, current.u)),
    getVertex: (previous, current, fraction) => {
      const v = interpolate(previous.v, current.v, fraction)
      return {
        ...getInterpolatedPosition(previous, current, fraction),
        u: 0,
        v,
        code: getDecalCodeFromV(v),
      }
    },
  },
  {
    bit: 2,
    getFraction: (previous, current) =>
      divide(subtract(ONE, previous.u), subtract(current.u, previous.u)),
    getVertex: (previous, current, fraction) => {
      const v = interpolate(previous.v, current.v, fraction)
      return {
        ...getInterpolatedPosition(previous, current, fraction),
        u: DECAL_EDGE,
        v,
        code: getDecalCodeFromV(v),
      }
    },
  },
  {
    bit: 4,
    getFraction: (previous, current) => divide(previous.v, subtract(previous.v, current.v)),
    getVertex: (previous, current, fraction) => ({
      ...getInterpolatedPosition(previous, current, fraction),
      u: interpolate(previous.u, current.u, fraction),
      v: 0,
      code: 0,
    }),
  },
  {
    bit: 8,
    getFraction: (previous, current) =>
      divide(subtract(ONE, previous.v), subtract(current.v, previous.v)),
    getVertex: (previous, current, fraction) => ({
      ...getInterpolatedPosition(previous, current, fraction),
      u: interpolate(previous.u, current.u, fraction),
      v: DECAL_EDGE,
      code: 0,
    }),
  },
]

// 0x00414f40's clipping of one face: a stage runs only when a corner of the face carries its bit; it walks the polygon
// from its last corner, adds the crossing of every edge whose ends differ in the bit, and keeps the corners without it.
export const clipDecalPolygon = (
  corners: readonly DecalPolygonVertex[]
): readonly DecalPolygonVertex[] => {
  const faceCode = corners.reduce((code, corner) => code | corner.code, 0)
  return STAGES.filter((stage) => (faceCode & stage.bit) !== 0).reduce<
    readonly DecalPolygonVertex[]
  >((polygon, stage) => {
    const clipped: DecalPolygonVertex[] = []
    polygon.forEach((current, index) => {
      const previous = polygon[(index + polygon.length - 1) % polygon.length]
      if (previous === undefined) return
      if ((current.code & stage.bit) !== (previous.code & stage.bit)) {
        const fraction = stage.getFraction(previous, current)
        clipped.push(Object.freeze(stage.getVertex(previous, current, fraction)))
      }
      if ((current.code & stage.bit) === 0) clipped.push(current)
    })
    return clipped
  }, corners)
}

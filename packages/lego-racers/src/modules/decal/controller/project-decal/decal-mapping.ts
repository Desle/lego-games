import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { DecalFrame, DecalPolygonVertex } from '../../types/decal.types.ts'
import type { DecalMapping } from './decal-mapping.types.ts'

const { add, multiply, divide, storeFloat } = createFloatArithmetic(RACE_FPU_PRECISION)

// 0x004af920: the picture's edge (0.99) that the box's size maps to, and 0x004af58c: the middle of the picture.
export const DECAL_EDGE = Math.fround(0.99)
const HALF = 0.5
const ONE_BITS = 0x3f800000

const bitsView = new DataView(new ArrayBuffer(4))

export const getFloatBits = (value: number): number => {
  bitsView.setFloat32(0, value)
  return bitsView.getUint32(0)
}

// 0x00414d50: the coefficients that turn a world point into picture coordinates (u along the right vector, v along
// the up vector, 0.99 over the box's size, 0.5 at its centre), as the engine stores them (+0x4c3de8..+0x4c3e1c).
export const getDecalMapping = (frame: DecalFrame): DecalMapping => {
  const horizontal = divide(DECAL_EDGE, frame.width)
  const vertical = divide(DECAL_EDGE, frame.height)
  const { right, up, position } = frame
  const getOffset = (axis: typeof right, scale: number): number =>
    storeFloat(
      add(
        multiply(
          -add(
            add(multiply(axis.x, position.x), multiply(axis.y, position.y)),
            multiply(axis.z, position.z)
          ),
          scale
        ),
        HALF
      )
    )
  return Object.freeze({
    uX: storeFloat(multiply(right.x, horizontal)),
    vX: storeFloat(multiply(up.x, vertical)),
    uY: storeFloat(multiply(right.y, horizontal)),
    vY: storeFloat(multiply(up.y, vertical)),
    uZ: storeFloat(multiply(right.z, horizontal)),
    vZ: storeFloat(multiply(up.z, vertical)),
    uOffset: getOffset(right, horizontal),
    vOffset: getOffset(up, vertical),
  })
}

// 0x00414e40's out-code from the bit patterns of u and v: bit 1 when u is negative, 2 when it is above 1 (a negative
// u is not), 4 and 8 the same for v; a value of exactly 1 is inside.
export const getDecalCode = (u: number, v: number): number => {
  const uBits = getFloatBits(u)
  const vBits = getFloatBits(v)
  const signs = ((((vBits & 0x9fffffff) | (uBits >>> 2)) >>> 29) & 7) >>> 0
  const above =
    ((((ONE_BITS - uBits) >>> 0) >>> 2) & 0x20000000) | (((ONE_BITS - vBits) >>> 0) & 0x8fffffff)
  return ((above >>> 28) & ~(signs * 2) & 0xf) | signs
}

// 0x004150xx (a vertex made on a u edge): the out-code from v alone.
export const getDecalCodeFromV = (v: number): number => {
  const bits = getFloatBits(v)
  return (
    (((((ONE_BITS - bits) >>> 0) & ~bits & 0x8fffffff) | ((bits >>> 1) & 0x40000000)) >>> 28) & 0xf
  )
}

// 0x00414e40 for one vertex: its picture coordinates, each sum stored as a float, and the out-code.
export const getDecalVertex = (
  mapping: DecalMapping,
  positions: Float32Array,
  vertexIndex: number
): DecalPolygonVertex => {
  const x = positions[vertexIndex * 3] ?? 0
  const y = positions[vertexIndex * 3 + 1] ?? 0
  const z = positions[vertexIndex * 3 + 2] ?? 0
  const u = storeFloat(
    add(
      storeFloat(add(storeFloat(multiply(mapping.uX, x)), multiply(y, mapping.uY))),
      multiply(z, mapping.uZ)
    )
  )
  const v = storeFloat(
    add(
      storeFloat(add(storeFloat(multiply(mapping.vX, x)), multiply(y, mapping.vY))),
      multiply(z, mapping.vZ)
    )
  )
  const shiftedU = storeFloat(add(mapping.uOffset, u))
  const shiftedV = storeFloat(add(mapping.vOffset, v))
  return Object.freeze({
    x,
    y,
    z,
    u: shiftedU,
    v: shiftedV,
    code: getDecalCode(shiftedU, shiftedV),
  })
}

import type { MaterialAnimation } from '../../../material-animation/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { EmitterSystem, Particle } from '../../types/emitter-pool.types.ts'
import type {
  BillboardAxes,
  BillboardCamera,
  EmitterQuad,
  EmitterQuadCorner,
} from '../../types/emitter-quad.types.ts'

const HALF = getFloatFromBits(0x3f000000)
// 0x00412ce0: the picture is used from 0.01 to 0.98 (0x3c23d70a and 0x3f7ae148).
const PICTURE_NEAR = getFloatFromBits(0x3c23d70a)
const PICTURE_FAR = getFloatFromBits(0x3f7ae148)
const UNKNOWN_MATERIAL = ''

// 0x00412ce0 adds the faces (corner 2, 1, 0) and (corner 3, 2, 0).
export const QUAD_TRIANGLE_CORNERS: readonly (readonly [number, number, number])[] = Object.freeze([
  Object.freeze([2, 1, 0] as const),
  Object.freeze([3, 2, 0] as const),
])

// The camera frame's slot 0x30 and 0x34 vectors (0x10002f50, 0x10002f70) are its first two rows: right and down. The
// engine passes the camera "up" as the second row and the forward vector as the third; the first is their cross
// product, up x forward.
export const getBillboardAxes = (
  arithmetic: FloatArithmetic,
  forward: Vector3,
  up: Vector3
): BillboardAxes => {
  const { subtract, multiply, storeFloat } = arithmetic
  return Object.freeze({
    right: Object.freeze({
      x: storeFloat(subtract(multiply(up.y, forward.z), multiply(up.z, forward.y))),
      y: storeFloat(subtract(multiply(up.z, forward.x), multiply(up.x, forward.z))),
      z: storeFloat(subtract(multiply(up.x, forward.y), multiply(up.y, forward.x))),
    }),
    down: up,
  })
}

const getScaled = (arithmetic: FloatArithmetic, axis: Vector3, scale: number): Vector3 =>
  Object.freeze({
    x: arithmetic.storeFloat(arithmetic.multiply(scale, axis.x)),
    y: arithmetic.storeFloat(arithmetic.multiply(axis.y, scale)),
    z: arithmetic.storeFloat(arithmetic.multiply(scale, axis.z)),
  })

// 0x00412ce0 for one particle: the half sizes follow the particle's age when the system moves (flag 0x4); a size that is
// not above zero draws nothing. The four corners start at the centre minus half of each axis and go along the first
// axis, the second, and back.
const getParticleQuad = (
  arithmetic: FloatArithmetic,
  system: EmitterSystem,
  particle: Particle,
  axes: BillboardAxes,
  materialName: string
): EmitterQuad | null => {
  const { add, subtract, multiply, divide, storeFloat, getIsBelowOrEqual } = arithmetic
  let widthScale = system.firstFloat
  let heightScale = system.secondFloat
  if (system.isMoving) {
    const fraction = divide(particle.ageMilliseconds, particle.lifetimeMilliseconds)
    widthScale = storeFloat(add(multiply(system.thirdFloat, fraction), system.firstFloat))
    heightScale = storeFloat(add(multiply(system.fourthFloat, fraction), system.secondFloat))
    if (getIsBelowOrEqual(widthScale, 0) || getIsBelowOrEqual(heightScale, 0)) return null
  }
  const right = getScaled(arithmetic, axes.right, widthScale)
  const down = getScaled(arithmetic, axes.down, heightScale)
  const centre = particle.position
  const first: Vector3 = Object.freeze({
    x: storeFloat(subtract(centre.x, add(multiply(right.x, HALF), multiply(down.x, HALF)))),
    y: storeFloat(subtract(centre.y, add(multiply(right.y, HALF), multiply(down.y, HALF)))),
    z: storeFloat(subtract(centre.z, add(multiply(down.z, HALF), multiply(right.z, HALF)))),
  })
  const getMoved = (from: Vector3, by: Vector3, sign: number): Vector3 =>
    Object.freeze({
      x: storeFloat(sign < 0 ? subtract(from.x, by.x) : add(from.x, by.x)),
      y: storeFloat(sign < 0 ? subtract(from.y, by.y) : add(from.y, by.y)),
      z: storeFloat(sign < 0 ? subtract(from.z, by.z) : add(from.z, by.z)),
    })
  const second = getMoved(first, right, 1)
  const third = getMoved(second, down, 1)
  const fourth = getMoved(third, right, -1)
  const getCorner = (position: Vector3, u: number, v: number): EmitterQuadCorner =>
    Object.freeze({
      x: storeFloat(add(position.x, system.framePosition.x)),
      y: storeFloat(add(position.y, system.framePosition.y)),
      z: storeFloat(add(position.z, system.framePosition.z)),
      u,
      v,
    })
  return Object.freeze({
    materialName,
    corners: Object.freeze([
      getCorner(first, PICTURE_NEAR, PICTURE_NEAR),
      getCorner(second, PICTURE_FAR, PICTURE_NEAR),
      getCorner(third, PICTURE_FAR, PICTURE_FAR),
      getCorner(fourth, PICTURE_NEAR, PICTURE_FAR),
    ] as const),
  })
}

// 0x00412a50 (the system's draw): a system that runs and has particles, within its radius of the camera, draws a quad
// for each particle that has a material, grouped by material in the order the materials first appear in the list. The
// material is the emitter's linked one, or the animation's row.
export const getEmitterQuads = (
  arithmetic: FloatArithmetic,
  system: EmitterSystem,
  animation: MaterialAnimation | null,
  camera: BillboardCamera
): readonly EmitterQuad[] => {
  const { add, subtract, multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  if (!system.isActive || system.particles.length === 0) return []
  const x = subtract(camera.position.x, system.framePosition.x)
  const y = subtract(camera.position.y, system.framePosition.y)
  const z = subtract(camera.position.z, system.framePosition.z)
  const squaredDistance = storeFloat(add(add(multiply(z, z), multiply(y, y)), multiply(x, x)))
  if (!getIsBelowOrEqual(squaredDistance, system.squaredRadius)) return []
  const getMaterialName = (particle: Particle): string | null => {
    if (!particle.isDrawable) return null
    if (system.entryIndex === null) return system.defaultMaterialName
    const row = particle.tableIndex === null ? undefined : animation?.materials[particle.tableIndex]
    return row?.materialName ?? UNKNOWN_MATERIAL
  }
  const names = system.particles.map(getMaterialName)
  const order = [...new Set(names.filter((name): name is string => name !== null))]
  return Object.freeze(
    order.flatMap((materialName) =>
      system.particles.flatMap((particle, index) => {
        if (names[index] !== materialName) return []
        const quad = getParticleQuad(arithmetic, system, particle, camera.axes, materialName)
        return quad === null ? [] : [quad]
      })
    )
  )
}

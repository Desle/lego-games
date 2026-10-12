import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { DecalLimits, DecalPlacement } from '../../types/decal.types.ts'

const { add, storeFloat } = createFloatArithmetic(RACE_FPU_PRECISION)

// 0x004b0170: the decal's box is centred this far above the ground point it is placed at.
const CENTRE_HEIGHT = 5
// 0x00414950 is asked for 16 triangles by the oil slick (0x004571b0) and for 10 by an explosion (0x00421250).
export const OIL_SLICK_DECAL_LIMITS: DecalLimits = Object.freeze({ maximumTriangles: 16 })
export const EXPLOSION_SCAR_DECAL_LIMITS: DecalLimits = Object.freeze({ maximumTriangles: 10 })
// 0x0048ff50 asks 0x00414950 for 32 triangles for the crane's shadow.
export const CRANE_SHADOW_DECAL_LIMITS: DecalLimits = Object.freeze({ maximumTriangles: 32 })

const DOWNWARD: Vector3 = Object.freeze({ x: 0, y: 0, z: -1 })
const FORWARD_HINT: Vector3 = Object.freeze({ x: 1, y: 0, z: 0 })
// 0x004b0138: the box reaches 15 units along the projection.
const REACH = 15
const OIL_SLICK_SIZE = 15
// 0x00490330 sets the crane shadow's width and height to 13 (0x41500000), its depth to 15 (0x41700000).
const CRANE_SHADOW_SIZE = 13

const getRaisedCentre = (ground: Vector3): Vector3 =>
  Object.freeze({ x: ground.x, y: ground.y, z: storeFloat(add(ground.z, CENTRE_HEIGHT)) })

// 0x004573a0 (after the landing): the picture straight down, 15 across, centred 5 above the ground point 0x00456360 found.
export const getOilSlickPlacement = (ground: Vector3): DecalPlacement =>
  Object.freeze({
    position: getRaisedCentre(ground),
    normal: DOWNWARD,
    upHint: FORWARD_HINT,
    width: OIL_SLICK_SIZE,
    height: OIL_SLICK_SIZE,
    depth: OIL_SLICK_SIZE,
  })

// 0x00421520 and 0x00421850: a ground burst's scar, square with the side the burst has grown to, centred 5 above the
// burst.
export const getExplosionScarPlacement = (burst: Vector3, size: number): DecalPlacement =>
  Object.freeze({
    position: getRaisedCentre(burst),
    normal: DOWNWARD,
    upHint: FORWARD_HINT,
    width: size,
    height: size,
    depth: REACH,
  })

// 0x00490330: the crane shadow lies straight down from the point of the crane's fourth bone (no lift), 13 across, with the
// first row of the crane's frame as the up hint.
export const getCraneShadowPlacement = (bone: Vector3, upHint: Vector3): DecalPlacement =>
  Object.freeze({
    position: bone,
    normal: DOWNWARD,
    upHint,
    width: CRANE_SHADOW_SIZE,
    height: CRANE_SHADOW_SIZE,
    depth: REACH,
  })

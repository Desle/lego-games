import type { DecalFrame, DecalTriangle } from '../../decal/index.ts'
import type { Vector3 } from '../../simulation-math/index.ts'

// One trail of the pool (0x334 bytes, constructor 0x00491c70; offsets in the comments): a ribbon that follows a wheel
// as decals on the track.
export type SkidTrail = {
  // +0x328 bit 0x1: in use.
  readonly isActive: boolean
  // Bit 0x2: letting go, the alpha fades over `durationMilliseconds`.
  readonly isFading: boolean
  // Bit 0x4: the ring of finished stretches is full.
  readonly isRingFull: boolean
  // Bit 0x10: the first point has not arrived.
  readonly isWaitingForFirstPoint: boolean
  // Bit 0x20: the wheel moved far enough to change the stretch in progress.
  readonly isDirty: boolean
  // Bit 0x8: the stretch in progress is shown.
  readonly isShowingLive: boolean
  // +0x314, +0x318: the milliseconds it lasts (a fade lasts as long as given) and one stretch lasts.
  readonly durationMilliseconds: number
  readonly segmentMilliseconds: number
  // +0x31c: milliseconds in the stretch, or in the fade.
  readonly elapsedMilliseconds: number
  // +0x320: the slot of the ring the next finished stretch goes to.
  readonly ringIndex: number
  // +0x324: how wide the mark is.
  readonly width: number
  // +0x32c, +0x330: the alpha that replaces the material's while it is below 255, and what the image scales it by.
  readonly alpha: number
  readonly baseAlpha: number
  // +0x2fc and +0x308: the point the stretch started at and the last one.
  readonly previousPoint: Vector3
  readonly currentPoint: Vector3
  // The decal of the stretch in progress (the projection of `frame`) and the three finished stretches.
  readonly frame: DecalFrame | null
  readonly live: readonly DecalTriangle[]
  readonly ring: readonly (readonly DecalTriangle[])[]
  // Who made it.
  readonly racerIndex: number
}

// 0x00492680: the four trails every racer shares.
export type SkidTrailPool = {
  readonly trails: readonly SkidTrail[]
}

// A trail to draw.
export type SkidTrailMesh = {
  readonly racerIndex: number
  readonly alpha: number
  readonly triangles: readonly DecalTriangle[]
}

// Who a new trail is for, how wide it is and what its image scales a fade's alpha by.
export type SkidTrailRequest = {
  readonly racerIndex: number
  readonly width: number
  readonly baseAlpha: number
}

// The pool after a trail was taken from it, and the trail's index (null when none was free).
export type SkidTrailAllocation = {
  readonly pool: SkidTrailPool
  readonly index: number | null
}

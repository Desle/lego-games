import type { Matrix3, Vector3 } from '../../simulation-math/index.ts'

// What 0x00441790 and 0x00441330 read of a box rigid body (vtable 0x004b0b84): the frame's rotation
// (frame +0x28), the world centre of mass (+0x20), the box dimensions (+0xd0) and the scale (+0xdc).
export type OrientedBox = {
  readonly rotation: Matrix3
  readonly centre: Vector3
  readonly dimensions: Vector3
  readonly scale: number
}

// The result of 0x00441790 for two boxes that overlap. `depth` is the smallest overlap along the
// face axes; `normal` points from the second box to the first (all zero when no face axis was
// smaller than FLT_MAX); `firstReach` and `secondReach` are what 0x00441330 compares corner depths against.
export type BoxOverlap = {
  readonly depth: number
  readonly normal: Vector3
  readonly firstReach: number
  readonly secondReach: number
}

// 0x00441330: the overlap plus the average of the corners that lie deepest in the other box.
export type BoxContact = {
  readonly depth: number
  readonly normal: Vector3
  readonly point: Vector3
}

// The display frame's bounding sphere (frame vtable 0x004af754 slot 0x4c, 0x004113d0).
export type BoundingSphere = {
  readonly centre: Vector3
  readonly radius: number
}

// The sphere the sweep sorts on: its extent along the x axis, frame +0x14 and +0x18.
export type BoundingInterval = {
  readonly minimum: number
  readonly maximum: number
}

export type Triple = readonly [number, number, number]

// One separating axis of 0x00441790: the offset's projection on it, the other box's extent on it before it is
// stored (FST keeps the value on the FPU stack), and the half extent of the box the axis belongs to.
export type AxisTest = {
  readonly distance: number
  readonly reach: number
  readonly half: number
}

// The best face axis so far: the smallest overlap, its index (-1 before any), and the two reaches written with it.
export type AxisResult = {
  readonly minimum: number
  readonly axis: number
  readonly firstReach: number
  readonly secondReach: number
}

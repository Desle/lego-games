import type { BspTree } from '../../bsp-tree/index.ts'
import type { Vector3 } from '../../simulation-math/index.ts'

// What a decal is placed with (0x0043fa50 fills the decal object +0x7c with these): the centre of its box, the
// direction it projects along, a vector that tells which way its picture is up, the picture's size and how far the
// box reaches along the projection.
export type DecalPlacement = {
  readonly position: Vector3
  readonly normal: Vector3
  readonly upHint: Vector3
  readonly width: number
  readonly height: number
  readonly depth: number
}

// 0x00414c90: the placement's axes: the projection direction normalised, the up vector made perpendicular to it and
// normalised, and the right vector (up x normal).
export type DecalFrame = {
  readonly position: Vector3
  readonly normal: Vector3
  readonly up: Vector3
  readonly right: Vector3
  readonly width: number
  readonly height: number
  readonly depth: number
}

// One corner of a decal triangle: where it lies in the world, and where it sits in the picture.
export type DecalVertex = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly u: number
  readonly v: number
}

export type DecalTriangle = readonly [DecalVertex, DecalVertex, DecalVertex]

// The faces of one run of draw commands (a `select_material` to the next) of the world's mesh.
export type DecalFaceBatch = {
  // The index of the command that opened the run.
  readonly firstCommand: number
  // The run's material has the decal flag 0x20000 (material keyword 0x4a).
  readonly isReceiver: boolean
  readonly faces: readonly (readonly [number, number, number])[]
}

// The world a decal is projected onto: its BSP tree (the leaves name runs of commands) and its mesh, with positions
// already in the race's frame (a mirrored race has y negated).
export type DecalWorld = {
  readonly tree: BspTree
  readonly positions: Float32Array
  readonly batches: readonly DecalFaceBatch[]
}

// 0x00415810 stops adding faces when the decal's capacity is reached (0x0043d9cc asks for 16).
export type DecalLimits = {
  readonly maximumTriangles: number
}

// A corner of the polygon being clipped: the cache slot of 0x00414e40 (`+0x14` is its out-code).
export type DecalPolygonVertex = DecalVertex & {
  readonly code: number
}

// A BSP plane as four floats: the normal and the offset.
export type DecalPlane = readonly [number, number, number, number]

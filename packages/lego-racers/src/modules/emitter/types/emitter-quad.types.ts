import type { Vector3 } from '../../simulation-math/index.ts'

// The camera frame's first two rows.
export type BillboardAxes = {
  readonly right: Vector3
  readonly down: Vector3
}

// A corner of a particle's quad, in the world.
export type EmitterQuadCorner = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly u: number
  readonly v: number
}

export type EmitterQuad = {
  readonly materialName: string
  readonly corners: readonly [
    EmitterQuadCorner,
    EmitterQuadCorner,
    EmitterQuadCorner,
    EmitterQuadCorner,
  ]
}

// What a system's draw needs of the camera.
export type BillboardCamera = {
  readonly position: Vector3
  readonly axes: BillboardAxes
}

// Where the camera is and which way it looks (a unit vector).
export type EmitterQuadView = {
  readonly position: Vector3
  readonly forward: Vector3
}

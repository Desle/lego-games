import type { BufferGeometry, Data3DTexture, Mesh, Vector3 } from 'three'

// A model's surface as a coarse grid, in the model's own frame: what the plastic samples to find the bricks around a point.
export type OcclusionVolume = {
  readonly texture: Data3DTexture
  readonly origin: Vector3
  readonly size: Vector3
  readonly cell: number
}

// The grid of an occlusion volume as plain numbers (what a worker can send): the voxels (x fastest) and where they lie in the model.
export type OcclusionGrid = {
  readonly data: Uint8Array
  readonly counts: readonly [number, number, number]
  readonly origin: readonly [number, number, number]
  readonly size: readonly [number, number, number]
  readonly cell: number
}

export type GeometryMesh = Mesh

// A mesh's vertices in the model's frame.
export type ModelMesh = {
  readonly geometry: BufferGeometry
  readonly positions: Float32Array
  readonly normals: Float32Array
}

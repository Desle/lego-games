import type { SceneAmbientLight, SceneDirectionalLight } from '../../types/scene.types.ts'

// A mesh a builder made in memory: one vertex list and the triangles of each material (an index into the material
// libraries the scene loads). The car builder's `CarGeometry` has this shape.
export type GeometryBatch = {
  readonly materialIndex: number
  // Three vertex indices per triangle.
  readonly vertexIndices: Uint32Array
}

export type ModelGeometry = {
  // x, y, z per vertex.
  readonly positions: Float32Array
  // x, y, z per vertex.
  readonly normals: Float32Array
  // u, v per vertex.
  readonly textureCoordinates: Float32Array
  readonly batches: readonly GeometryBatch[]
}

// The files the geometry's materials come from, as for `loadModelScene`.
export type GeometryFiles = {
  readonly directory: string
  readonly textureNames: readonly string[]
  readonly materialNames: readonly string[]
  // The lights that shine on the model (a model with normals is lit by the device, and the track worlds set none).
  readonly ambientLights: readonly SceneAmbientLight[]
  readonly directionalLights: readonly SceneDirectionalLight[]
}

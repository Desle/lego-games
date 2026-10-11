import type { SceneAmbientLight, SceneDirectionalLight } from '../../types/scene.types.ts'

// A mesh a builder made in memory: one vertex list and the triangles of each material (an index into the material
// libraries the scene loads). The car builder's `CarGeometry` has this shape.
export type GeometryBatch = {
  readonly materialIndex: number
  // Three vertex indices per triangle.
  readonly vertexIndices: Uint32Array
  // The bone each corner follows; absent for a model without bones (every corner on bone 0).
  readonly transformIndices?: Uint8Array
  // Replaces the material's ambient and diffuse colours (a figure's tinted materials); absent keeps the library's.
  readonly tint?: readonly [number, number, number, number]
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
  // A model with bones names the skeleton and animation its mesh follows, read from `directory`.
  readonly bones: GeometryBones | null
}

export type GeometryBones = {
  readonly directory: string
  readonly skeletonName: string
  readonly animationName: string
  // Where the animation file is, when it is not beside the skeleton (the menu figures: `LEGOMAN.ADB` is in MENUDATA).
  readonly animationDirectory?: string
}

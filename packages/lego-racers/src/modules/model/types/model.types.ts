import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { ModelCommandKind as ModelCommandKindValues } from './model-command-kind/model-command-kind.ts'
import type { VertexFormat as VertexFormatValues } from './vertex-format/vertex-format.ts'

export type VertexFormat = EnumValues<typeof VertexFormatValues>

export type ModelCommandKind = EnumValues<typeof ModelCommandKindValues>

export type ModelVertexBuffer = {
  readonly format: VertexFormat
  readonly vertexCount: number
  // x, y, z per vertex
  readonly positions: readonly number[]
  // u, v per vertex
  readonly textureCoordinates: readonly number[]
  // x, y, z per vertex
  readonly normals: readonly number[]
  // 0xAARRGGBB per vertex
  readonly colors: readonly number[]
}

export type ModelFace = readonly [number, number, number]

export type TransformVerticesCommand = {
  readonly kind: typeof ModelCommandKindValues.TRANSFORM_VERTICES
  readonly cacheIndex: number
  readonly firstVertex: number
  readonly vertexCount: number
}

export type DrawFacesCommand = {
  readonly kind: typeof ModelCommandKindValues.DRAW_FACES
  readonly firstFace: number
  readonly faceCount: number
}

export type SelectMaterialCommand = {
  readonly kind: typeof ModelCommandKindValues.SELECT_MATERIAL
  readonly materialIndex: number
}

export type SelectTransformCommand = {
  readonly kind: typeof ModelCommandKindValues.SELECT_TRANSFORM
  readonly transformIndex: number
}

export type ModelCommand =
  TransformVerticesCommand | DrawFacesCommand | SelectMaterialCommand | SelectTransformCommand

export type Model = {
  // First eight characters of each name, as the engine copies them before the lookup.
  readonly materialNames: readonly string[]
  readonly vertexBuffer: ModelVertexBuffer | null
  readonly positionVertexBuffer: ModelVertexBuffer | null
  readonly faces: readonly ModelFace[]
  readonly commands: readonly ModelCommand[]
  readonly scale: number
  readonly readByteCount: number
}

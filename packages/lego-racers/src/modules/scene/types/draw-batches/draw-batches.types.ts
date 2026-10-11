export type DrawFace = readonly [number, number, number]

// The command shapes of a parsed model (model module), restated so this layer imports nothing.
export type DrawCommand =
  | {
      readonly kind: 'transform_vertices'
      readonly cacheIndex: number
      readonly firstVertex: number
      readonly vertexCount: number
    }
  | { readonly kind: 'draw_faces'; readonly firstFace: number; readonly faceCount: number }
  | { readonly kind: 'select_material'; readonly materialIndex: number }
  | { readonly kind: 'select_transform'; readonly transformIndex: number }

export type DrawBatchBuilder = {
  readonly materialSlot: number
  readonly firstCommand: number
  readonly vertexIndices: number[]
  readonly transformIndices: number[]
}

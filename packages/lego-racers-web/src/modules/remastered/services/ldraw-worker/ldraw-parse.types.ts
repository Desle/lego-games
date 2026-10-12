import type { LDrawDetail } from '../ldraw-library/ldraw-library-loader.types.ts'
import type { MergedPrimitiveKind } from '../ldraw-car/ldraw-model-merge.types.ts'
import type { OcclusionGrid } from '../ldraw-car/ldraw-occlusion.types.ts'

// What the page asks the parser for: a model's text, at a detail, whether to bake its occlusion grid (the look needs one), and
// whether to take the wheels and any minifigure out of it (a car's body).
export type ParseRequest = {
  readonly text: string
  readonly detail: LDrawDetail
  readonly isOcclusionBaked: boolean
  readonly isTakingWheels: boolean
}

export type ParseMessage = {
  readonly id: number
  readonly request: ParseRequest
}

// A material as plain numbers: enough to make the library's again (a standard material for triangles, a line material for edges).
export type SerializedMaterial = {
  readonly name: string
  readonly color: readonly [number, number, number]
  readonly roughness: number
  readonly metalness: number
  readonly opacity: number
  readonly isTransparent: boolean
  readonly isDepthWritten: boolean
  readonly isPolygonOffset: boolean
  readonly polygonOffsetFactor: number
  readonly polygonOffsetUnits: number
}

export type SerializedAttribute = {
  readonly name: string
  readonly itemSize: number
  readonly array: Float32Array
}

// One mesh or one set of line segments of a merged model.
export type SerializedPrimitive = {
  readonly kind: MergedPrimitiveKind
  readonly materialIndex: number
  readonly attributes: readonly SerializedAttribute[]
}

export type SerializedModel = {
  readonly materials: readonly SerializedMaterial[]
  readonly primitives: readonly SerializedPrimitive[]
}

export type SerializedWheel = {
  readonly centre: readonly [number, number, number]
  readonly model: SerializedModel
}

export type ParseResult = {
  readonly body: SerializedModel
  readonly wheels: readonly SerializedWheel[]
  readonly grid: OcclusionGrid | null
}

export type ParseResponse =
  | { readonly id: number; readonly result: ParseResult; readonly message: null }
  | { readonly id: number; readonly result: null; readonly message: string }

// The part of a worker's global scope the parser uses (the DOM's `postMessage` types take no transfer list).
export type ParseWorkerScope = {
  readonly postMessage: (message: ParseResponse, transfer: ArrayBuffer[]) => void
  readonly addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<ParseMessage>) => void
  ) => void
}

// A request the worker has not answered yet.
export type PendingParse = {
  readonly resolve: (result: ParseResult) => void
  readonly reject: (error: Error) => void
}

import type { Group, Vector3 } from 'three'
import type { LDrawDetail } from '../../../library/index.ts'
import type { MergedPrimitiveKind } from '../ldraw-model-merge/ldraw-model-merge.types.ts'
import type { OcclusionGrid } from '../../../material/index.ts'

// What the page asks the parser for: a model's text, at a detail, from the library at `libraryUrl`, whether to bake its occlusion grid
// (the look needs one), and whether to split sub-models out of it with the app's splitter (a car's wheels and figures).
export type ParseRequest = {
  readonly text: string
  readonly detail: LDrawDetail
  readonly libraryUrl: string
  readonly isOcclusionBaked: boolean
  readonly isSplittingSubModels: boolean
}

// A sub-model the app's splitter took out of a parsed model: its parts gathered in one group that keeps the places they had in the
// model (LDraw units), and its centre.
export type SplitSubModel = {
  readonly unit: Group
  readonly centre: Vector3
}

// Takes the app's sub-models out of a parsed model (removing them from it). It runs where the parsing does: in the worker.
export type SubModelSplitter = (model: Group) => readonly SplitSubModel[]

export type WorkMeasurer = <Result>(label: string, work: () => Result) => Result

// What the app tells the parser once, before the first model: where the library is served, how to start its parse worker (a module
// worker whose script calls `listenForParseRequests`; null parses on the page's own thread), the splitter that thread uses, and where
// the time spent goes.
export type ModelParserSettings = {
  readonly libraryUrl: string
  readonly createWorker: (() => Worker) | null
  readonly splitSubModels: SubModelSplitter | null
  readonly addLoadMilliseconds: (milliseconds: number) => void
  readonly measureWork: WorkMeasurer
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
  readonly isMaterialList: boolean
  readonly attributes: readonly SerializedAttribute[]
}

export type SerializedModel = {
  readonly materials: readonly SerializedMaterial[]
  readonly primitives: readonly SerializedPrimitive[]
}

export type SerializedSubModel = {
  readonly centre: readonly [number, number, number]
  readonly model: SerializedModel
}

export type ParseResult = {
  readonly body: SerializedModel
  readonly subModels: readonly SerializedSubModel[]
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

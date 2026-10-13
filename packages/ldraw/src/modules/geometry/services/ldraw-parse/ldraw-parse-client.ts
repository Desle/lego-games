import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import type { Material } from 'three'
import { LDrawConditionalLineMaterial } from 'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
import { createListMesh } from '../ldraw-model-merge/ldraw-model-merge.ts'
import { MergedPrimitiveKind } from '../ldraw-model-merge/ldraw-model-merge.types.ts'
import { LDRAW_COLOR_SPACE } from './ldraw-parse.constants.ts'
import { buildParseResult } from './ldraw-parse-work.ts'
import type {
  ModelParserSettings,
  ParseRequest,
  ParseResponse,
  PendingParse,
  ParseResult,
  SerializedMaterial,
  SerializedModel,
} from './ldraw-parse.types.ts'

let settings: ModelParserSettings | null = null
let worker: Worker | null = null
let isWorkerUnavailable = false
let nextId = 1
const pending = new Map<number, PendingParse>()

// The wall time the library spends delivering models counts once however many are in flight (the monitor's load time).
let busySince = 0

// Set by the app before the first model is asked for; a later call keeps the first settings and the worker they started.
export const setUpModelParser = (next: ModelParserSettings) => {
  settings ??= next
}

const getSettings = (): ModelParserSettings => {
  if (settings === null) throw new Error('Set up the LDraw model parser (setUpModelParser) first')
  return settings
}

export const getLibraryUrl = (): string => getSettings().libraryUrl

// Runs a piece of model work under the app's measurer (its performance monitor), or plainly before the parser is set up.
export const measureModelWork = <Result>(label: string, work: () => Result): Result =>
  settings === null ? work() : settings.measureWork(label, work)

const finishParse = () => {
  if (pending.size === 0) getSettings().addLoadMilliseconds(performance.now() - busySince)
}

const onWorkerMessage = (event: MessageEvent<ParseResponse>) => {
  const response = event.data
  const waiting = pending.get(response.id)
  pending.delete(response.id)
  if (response.result === null) waiting?.reject(new Error(response.message))
  else waiting?.resolve(response.result)
  finishParse()
}

const getWorker = (createWorker: (() => Worker) | null): Worker | null => {
  if (worker !== null || isWorkerUnavailable) return worker
  if (createWorker === null) {
    isWorkerUnavailable = true
    return null
  }
  try {
    worker = createWorker()
    worker.addEventListener('message', onWorkerMessage)
    worker.addEventListener('error', (event) => {
      console.error('The LDraw parser stopped', event.message)
      for (const waiting of pending.values()) waiting.reject(new Error(event.message))
      pending.clear()
      worker = null
      isWorkerUnavailable = true
    })
  } catch {
    isWorkerUnavailable = true
  }
  return worker
}

// A model's parts parsed, merged and baked: in a worker when the browser has one (the page keeps drawing while a model loads), on the
// page's own thread when it does not.
export const requestParsedModel = (request: ParseRequest): Promise<ParseResult> => {
  const { createWorker, splitSubModels } = getSettings()
  const parser = getWorker(createWorker)
  if (pending.size === 0) busySince = performance.now()
  if (parser === null) return buildParseResult(request, splitSubModels).finally(finishParse)
  const id = nextId
  nextId += 1
  return new Promise<ParseResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    parser.postMessage({ id, request })
  })
}

const createMaterial = (source: SerializedMaterial, kind: MergedPrimitiveKind): Material => {
  const color = new Color().setRGB(...source.color, LDRAW_COLOR_SPACE)
  const common = {
    transparent: source.isTransparent,
    opacity: source.opacity,
    depthWrite: source.isDepthWritten,
  }
  if (kind === MergedPrimitiveKind.CONDITIONAL_LINES) {
    const material = new LDrawConditionalLineMaterial({ fog: true, name: source.name, ...common })
    const target: unknown = Reflect.get(material, 'color')
    if (target instanceof Color) target.copy(color)
    return material
  }
  if (kind === MergedPrimitiveKind.LINES) {
    return new LineBasicMaterial({ color, name: source.name, ...common })
  }
  return new MeshStandardMaterial({
    color,
    name: source.name,
    roughness: source.roughness,
    metalness: source.metalness,
    polygonOffset: source.isPolygonOffset,
    polygonOffsetFactor: source.polygonOffsetFactor,
    polygonOffsetUnits: source.polygonOffsetUnits,
    ...common,
  })
}

const sharedLineMaterials = new Map<string, Material>()

// The loader hands every model of a page the same edge material for a colour, and the plastic look darkens each one it meets (a
// model's edge materials once each), so the edges of a colour that many models use come out near black. The edge materials are
// shared here for the same reason: the lines look as they did when the page parsed the models itself.
const getSharedLineMaterial = (source: SerializedMaterial, kind: MergedPrimitiveKind): Material => {
  const key = `${kind}|${source.name}|${source.color.join(',')}`
  const existing = sharedLineMaterials.get(key)
  if (existing !== undefined) return existing
  const material = createMaterial(source, kind)
  sharedLineMaterials.set(key, material)
  return material
}

// The merged model a worker sent, as the three.js objects the loader would have made: standard materials for triangles and the
// library's edge materials for lines.
export const deserializeModel = (model: SerializedModel): Group => {
  const group = new Group()
  const materials = new Map<string, Material>()
  for (const primitive of model.primitives) {
    const source = model.materials[primitive.materialIndex]
    if (source === undefined) continue
    const key = `${String(primitive.materialIndex)}|${primitive.kind}`
    const material =
      materials.get(key) ??
      (primitive.kind === MergedPrimitiveKind.TRIANGLES
        ? createMaterial(source, primitive.kind)
        : getSharedLineMaterial(source, primitive.kind))
    materials.set(key, material)
    const geometry = new BufferGeometry()
    for (const attribute of primitive.attributes) {
      geometry.setAttribute(
        attribute.name,
        new BufferAttribute(attribute.array, attribute.itemSize)
      )
    }
    if (primitive.kind === MergedPrimitiveKind.TRIANGLES) {
      group.add(
        primitive.isMaterialList ? createListMesh(geometry, material) : new Mesh(geometry, material)
      )
    } else {
      const lines = new LineSegments(geometry, material)
      Object.assign(lines, {
        isConditionalLine: primitive.kind === MergedPrimitiveKind.CONDITIONAL_LINES,
      })
      group.add(lines)
    }
  }
  return group
}

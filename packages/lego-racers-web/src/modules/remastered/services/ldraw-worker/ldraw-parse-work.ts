import { BufferAttribute, Color, LineSegments, Material, Mesh, MeshStandardMaterial } from 'three'
import type { BufferGeometry, Group, Object3D } from 'three'
import { bakeOcclusionGrid } from '../ldraw-car/ldraw-occlusion.ts'
import { mergeModelByMaterial } from '../ldraw-car/ldraw-model-merge.ts'
import { MergedPrimitiveKind } from '../ldraw-car/ldraw-model-merge.types.ts'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { takeWheelsAndFigures } from '../ldraw-racer-model/racer-model-parts.ts'
import { LDRAW_COLOR_SPACE } from './ldraw-parse.constants.ts'
import type {
  ParseRequest,
  ParseResult,
  SerializedAttribute,
  SerializedMaterial,
  SerializedModel,
  SerializedPrimitive,
} from './ldraw-parse.types.ts'

const getKind = (object: Object3D): MergedPrimitiveKind | null => {
  if (object instanceof Mesh) return MergedPrimitiveKind.TRIANGLES
  if (!(object instanceof LineSegments)) return null
  return Reflect.get(object, 'isConditionalLine') === true
    ? MergedPrimitiveKind.CONDITIONAL_LINES
    : MergedPrimitiveKind.LINES
}

const getColor = (material: Material): readonly [number, number, number] => {
  const color: unknown = Reflect.get(material, 'color')
  if (!(color instanceof Color)) return [1, 1, 1]
  // As sRGB, the library's own space: the page makes the colour from it in whatever colour management it runs with.
  const { r, g, b } = color.getRGB({ r: 0, g: 0, b: 0 }, LDRAW_COLOR_SPACE)
  return [r, g, b]
}

const serializeMaterial = (material: Material): SerializedMaterial => ({
  name: material.name,
  color: getColor(material),
  roughness: material instanceof MeshStandardMaterial ? material.roughness : 1,
  metalness: material instanceof MeshStandardMaterial ? material.metalness : 0,
  opacity: material.opacity,
  isTransparent: material.transparent,
  isDepthWritten: material.depthWrite,
  isPolygonOffset: material.polygonOffset,
  polygonOffsetFactor: material.polygonOffsetFactor,
  polygonOffsetUnits: material.polygonOffsetUnits,
})

const serializeAttributes = (geometry: BufferGeometry): readonly SerializedAttribute[] =>
  Object.entries(geometry.attributes).flatMap(([name, attribute]) =>
    attribute instanceof BufferAttribute && attribute.array instanceof Float32Array
      ? [{ name, itemSize: attribute.itemSize, array: attribute.array }]
      : []
  )

// A merged model (a few meshes and line sets) as plain numbers, each distinct material once.
export const serializeModel = (merged: Group): SerializedModel => {
  const materials: Material[] = []
  const primitives: SerializedPrimitive[] = []
  for (const child of merged.children) {
    const kind = getKind(child)
    const list: unknown = Reflect.get(child, 'material')
    const source: unknown = Array.isArray(list) ? list[0] : list
    const geometry: unknown = Reflect.get(child, 'geometry')
    if (kind === null || !getIsMaterial(source) || !isGeometry(geometry)) continue
    if (!materials.includes(source)) materials.push(source)
    primitives.push({
      kind,
      materialIndex: materials.indexOf(source),
      isMaterialList: Array.isArray(list),
      attributes: serializeAttributes(geometry),
    })
  }
  return { materials: materials.map(serializeMaterial), primitives }
}

const getIsMaterial = (value: unknown): value is Material => value instanceof Material

const isGeometry = (value: unknown): value is BufferGeometry =>
  value instanceof Object && Reflect.get(value, 'isBufferGeometry') === true

// Everything the main thread needs of a model, built away from it: the parts parsed (the slow step), the occlusion grid baked, the
// wheels taken out of a car's body, and each of them merged into a few primitives.
export const buildParseResult = async (request: ParseRequest): Promise<ParseResult> => {
  const model = await parseLDrawModel(request.text, request.detail)
  const grid = request.isOcclusionBaked ? bakeOcclusionGrid(model) : null
  const wheelUnits = request.isTakingWheels ? takeWheelsAndFigures(model) : []
  return {
    body: serializeModel(mergeModelByMaterial(model)),
    wheels: wheelUnits.map((wheel) => ({
      centre: wheel.centre.toArray(),
      model: serializeModel(mergeModelByMaterial(wheel.unit)),
    })),
    grid,
  }
}

const getModelBuffers = (model: SerializedModel): ArrayBuffer[] =>
  model.primitives.flatMap((primitive) =>
    primitive.attributes.map((attribute) => attribute.array.buffer as ArrayBuffer)
  )

// The buffers of a result, to move to the main thread instead of copying.
export const getTransferables = (result: ParseResult): ArrayBuffer[] => [
  ...getModelBuffers(result.body),
  ...result.wheels.flatMap((wheel) => getModelBuffers(wheel.model)),
  ...(result.grid === null ? [] : [result.grid.data.buffer as ArrayBuffer]),
]

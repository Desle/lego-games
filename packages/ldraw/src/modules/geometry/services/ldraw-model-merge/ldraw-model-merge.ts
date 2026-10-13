import { BufferAttribute, BufferGeometry, Group, LineSegments, Matrix3, Mesh, Vector3 } from 'three'
import type { Material, Matrix4, Object3D } from 'three'
import { MergedPrimitiveKind } from './ldraw-model-merge.types.ts'
import type { GeometryChunk, MergeBucket } from './ldraw-model-merge.types.ts'

const POINT_ATTRIBUTES: readonly string[] = ['position', 'control0', 'control1']
const DIRECTION_ATTRIBUTES: readonly string[] = ['normal', 'direction']
const TRIANGLE_VERTICES = 3

const getIsConditionalLine = (object: Object3D): boolean =>
  Reflect.get(object, 'isConditionalLine') === true

const getMaterials = (material: Material | Material[]): readonly Material[] =>
  Array.isArray(material) ? material : [material]

// The runs of an object's vertices by material: its groups, or the whole geometry for one material.
const getRuns = (geometry: BufferGeometry, materials: readonly Material[]) => {
  const vertexCount = geometry.getAttribute('position').count
  if (geometry.groups.length === 0) {
    return materials[0] === undefined
      ? []
      : [{ material: materials[0], start: 0, count: vertexCount }]
  }
  return geometry.groups.flatMap((group) => {
    const material = materials[group.materialIndex ?? 0]
    return material === undefined ? [] : [{ material, start: group.start, count: group.count }]
  })
}

const getKind = (object: Object3D): MergedPrimitiveKind | null => {
  if (object instanceof Mesh) return MergedPrimitiveKind.TRIANGLES
  if (object instanceof LineSegments) {
    return getIsConditionalLine(object)
      ? MergedPrimitiveKind.CONDITIONAL_LINES
      : MergedPrimitiveKind.LINES
  }
  return null
}

const getAttributeNames = (geometry: BufferGeometry): string =>
  Object.keys(geometry.attributes).sort().join(',')

const getIsMergeable = (geometry: BufferGeometry): boolean =>
  geometry.index === null && geometry.hasAttribute('position')

// One attribute of a chunk, moved into the model's frame: points and directions follow the matrix, anything else (the baked
// occlusion, already in the model's frame) is copied.
const copyAttribute = (
  chunk: GeometryChunk,
  name: string,
  target: Float32Array,
  offset: number,
  normalMatrix: Matrix3
) => {
  const attribute = chunk.geometry.getAttribute(name)
  const vector = new Vector3()
  for (let index = 0; index < chunk.count; index += 1) {
    vector.fromBufferAttribute(attribute, chunk.start + index)
    if (POINT_ATTRIBUTES.includes(name)) vector.applyMatrix4(chunk.matrix)
    else if (DIRECTION_ATTRIBUTES.includes(name)) vector.applyMatrix3(normalMatrix).normalize()
    vector.toArray(target, (offset + index) * attribute.itemSize)
  }
}

// A mirrored placement turns the winding of its triangles; the merged mesh has no mirror, so the triangles are turned here.
const turnMirroredTriangles = (
  target: Float32Array,
  itemSize: number,
  offset: number,
  count: number
) => {
  for (let triangle = offset; triangle < offset + count; triangle += TRIANGLE_VERTICES) {
    for (let component = 0; component < itemSize; component += 1) {
      const second = (triangle + 1) * itemSize + component
      const third = (triangle + 2) * itemSize + component
      const swapped = target[second] ?? 0
      target.set([target[third] ?? 0], second)
      target.set([swapped], third)
    }
  }
}

const createMergedGeometry = (bucket: MergeBucket): BufferGeometry => {
  const [first] = bucket.chunks
  const geometry = new BufferGeometry()
  if (first === undefined) return geometry
  const total = bucket.chunks.reduce((sum, chunk) => sum + chunk.count, 0)
  for (const name of Object.keys(first.geometry.attributes)) {
    const itemSize = first.geometry.getAttribute(name).itemSize
    const target = new Float32Array(total * itemSize)
    let offset = 0
    for (const chunk of bucket.chunks) {
      const normalMatrix = new Matrix3().getNormalMatrix(chunk.matrix)
      copyAttribute(chunk, name, target, offset, normalMatrix)
      if (chunk.isMirrored && bucket.kind === MergedPrimitiveKind.TRIANGLES) {
        turnMirroredTriangles(target, itemSize, offset, chunk.count)
      }
      offset += chunk.count
    }
    geometry.setAttribute(name, new BufferAttribute(target, itemSize))
  }
  return geometry
}

// A mesh with a list of one material, as the loader makes a part of several colours: three.js draws a list's materials by the
// geometry's groups, so the whole geometry is the list's one group.
export const createListMesh = (geometry: BufferGeometry, material: Material): Mesh => {
  geometry.addGroup(0, geometry.getAttribute('position').count, 0)
  return new Mesh(geometry, [material])
}

const createMergedObject = (bucket: MergeBucket): Object3D => {
  const geometry = createMergedGeometry(bucket)
  if (bucket.kind === MergedPrimitiveKind.TRIANGLES) {
    return bucket.isMaterialList
      ? createListMesh(geometry, bucket.material)
      : new Mesh(geometry, bucket.material)
  }
  const lines = new LineSegments(geometry, bucket.material)
  Object.assign(lines, { isConditionalLine: bucket.kind === MergedPrimitiveKind.CONDITIONAL_LINES })
  return lines
}

// An object that cannot be merged (an indexed geometry, or attributes that differ) keeps its own geometry, put in the model's frame.
const createKeptObject = (object: Object3D, relative: Matrix4): Object3D => {
  const kept = object.clone(false)
  relative.decompose(kept.position, kept.quaternion, kept.scale)
  return kept
}

// Turns a loaded LDraw model (a tree of parts, each with a mesh and lines of its own) into a few objects: one mesh for each material
// and one set of line segments for each edge material, in the model's frame. For a model that never moves apart (a car's body, a
// minifigure's part), this is the same picture in a handful of draw calls instead of hundreds. The root's own transform is kept.
export const mergeModelByMaterial = (model: Group): Group => {
  model.updateMatrixWorld(true)
  const inverseRoot = model.matrixWorld.clone().invert()
  const buckets = new Map<string, MergeBucket>()
  const bucketKeys = new Map<Material, number>()
  const kept: Object3D[] = []
  model.traverse((object) => {
    const kind = getKind(object)
    if (kind === null) return
    const primitive = object as Mesh | LineSegments
    const relative = inverseRoot.clone().multiply(object.matrixWorld)
    if (!getIsMergeable(primitive.geometry)) {
      kept.push(createKeptObject(object, relative))
      return
    }
    const signature = getAttributeNames(primitive.geometry)
    const isMirrored = relative.determinant() < 0
    for (const run of getRuns(primitive.geometry, getMaterials(primitive.material))) {
      const materialIndex = bucketKeys.get(run.material) ?? bucketKeys.size
      bucketKeys.set(run.material, materialIndex)
      const isMaterialList = Array.isArray(primitive.material)
      const key = `${String(materialIndex)}|${kind}|${signature}|${String(isMaterialList)}`
      const bucket = buckets.get(key) ?? {
        material: run.material,
        kind,
        isMaterialList,
        chunks: [],
      }
      buckets.set(key, bucket)
      bucket.chunks.push({
        geometry: primitive.geometry,
        start: run.start,
        count: run.count,
        matrix: relative,
        isMirrored,
      })
    }
  })
  const merged = new Group()
  merged.position.copy(model.position)
  merged.quaternion.copy(model.quaternion)
  merged.scale.copy(model.scale)
  merged.userData = model.userData
  for (const bucket of buckets.values()) merged.add(createMergedObject(bucket))
  for (const object of kept) merged.add(object)
  return merged
}

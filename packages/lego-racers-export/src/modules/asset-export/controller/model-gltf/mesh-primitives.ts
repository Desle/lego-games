import type { SceneDrawBatch, SceneMesh } from '@lego-games/lego-racers/scene'
import {
  getTransformedNormals,
  getTransformedPositions,
} from '@lego-games/lego-racers/skeletal-animation'
import type { GltfBuilder, GltfPrimitive } from '../../services/gltf-builder/gltf-builder.types.ts'
import type { MaterialRegistry } from './material-registry.types.ts'
import type { CornerSet, MeshBake } from './mesh-primitives.types.ts'

const MAXIMUM_SHORT_INDEX = 0xffff
const TRANSFORM_RANGE = 256

// One entry per distinct (vertex, transform) pair of the batch's corners, in order of first use, and the index of
// each corner's entry. The transform only matters when the vertices are posed or skinned.
const getCornerSet = (batch: SceneDrawBatch, isTransformUsed: boolean): CornerSet => {
  const slotByKey = new Map<number, number>()
  const vertices: number[] = []
  const transforms: number[] = []
  const corners: number[] = []
  for (const [corner, vertex] of batch.vertexIndices.entries()) {
    const transform = isTransformUsed ? (batch.transformIndices[corner] ?? 0) : 0
    const key = vertex * TRANSFORM_RANGE + transform
    const existing = slotByKey.get(key)
    if (existing !== undefined) {
      corners.push(existing)
      continue
    }
    slotByKey.set(key, vertices.length)
    corners.push(vertices.length)
    vertices.push(vertex)
    transforms.push(transform)
  }
  return Object.freeze({
    vertices: Uint32Array.from(vertices),
    transforms: Uint8Array.from(transforms),
    corners: Uint32Array.from(corners),
  })
}

const getGathered = (source: Float32Array, vertices: Uint32Array, size: number): Float32Array => {
  const gathered = new Float32Array(vertices.length * size)
  for (const [slot, vertex] of vertices.entries()) {
    gathered.set(source.subarray(vertex * size, (vertex + 1) * size), slot * size)
  }
  return gathered
}

// glTF's texture origin is the picture's top-left; the engine's v = 0 is the picture's bottom edge.
const getFlippedTextureCoordinates = (coordinates: Float32Array): Float32Array =>
  coordinates.map((value, index) => (index % 2 === 1 ? 1 - value : value))

const getGatheredColors = (colors: Uint8Array, vertices: Uint32Array): Uint8Array => {
  const gathered = new Uint8Array(vertices.length * 4)
  for (const [slot, vertex] of vertices.entries()) {
    gathered.set(colors.subarray(vertex * 4, vertex * 4 + 4), slot * 4)
  }
  return gathered
}

const getJoints = (transforms: Uint8Array): Uint8Array => {
  const joints = new Uint8Array(transforms.length * 4)
  for (const [slot, transform] of transforms.entries()) joints[slot * 4] = transform
  return joints
}

const getWeights = (count: number): Float32Array => {
  const weights = new Float32Array(count * 4)
  for (let slot = 0; slot < count; slot++) weights[slot * 4] = 1
  return weights
}

const addBatchPrimitive = (
  builder: GltfBuilder,
  registry: MaterialRegistry,
  mesh: SceneMesh,
  batch: SceneDrawBatch,
  bake: MeshBake
): GltfPrimitive => {
  const cornerSet = getCornerSet(batch, bake.matrices !== null)
  const positions = getGathered(mesh.positions, cornerSet.vertices, 3)
  const normals = mesh.normals === null ? null : getGathered(mesh.normals, cornerSet.vertices, 3)
  const { matrices } = bake
  const attributes: Record<string, number> = {
    POSITION: builder.addAccessor({
      values:
        matrices === null
          ? positions
          : getTransformedPositions(positions, cornerSet.transforms, matrices),
      type: 'VEC3',
      target: 'vertices',
      isNormalized: false,
      isBounded: true,
    }),
    TEXCOORD_0: builder.addAccessor({
      values: getFlippedTextureCoordinates(
        getGathered(mesh.textureCoordinates, cornerSet.vertices, 2)
      ),
      type: 'VEC2',
      target: 'vertices',
      isNormalized: false,
      isBounded: false,
    }),
  }
  if (normals !== null) {
    attributes['NORMAL'] = builder.addAccessor({
      values:
        matrices === null
          ? normals
          : getTransformedNormals(normals, cornerSet.transforms, matrices),
      type: 'VEC3',
      target: 'vertices',
      isNormalized: false,
      isBounded: false,
    })
  }
  if (mesh.colors !== null) {
    attributes['COLOR_0'] = builder.addAccessor({
      values: getGatheredColors(mesh.colors, cornerSet.vertices),
      type: 'VEC4',
      target: 'vertices',
      isNormalized: true,
      isBounded: false,
    })
  }
  if (bake.isSkinned) {
    attributes['JOINTS_0'] = builder.addAccessor({
      values: getJoints(cornerSet.transforms),
      type: 'VEC4',
      target: 'vertices',
      isNormalized: false,
      isBounded: false,
    })
    attributes['WEIGHTS_0'] = builder.addAccessor({
      values: getWeights(cornerSet.transforms.length),
      type: 'VEC4',
      target: 'vertices',
      isNormalized: false,
      isBounded: false,
    })
  }
  const isShort = cornerSet.vertices.length <= MAXIMUM_SHORT_INDEX
  return Object.freeze({
    attributes,
    indices: builder.addAccessor({
      values: isShort ? Uint16Array.from(cornerSet.corners) : cornerSet.corners,
      type: 'SCALAR',
      target: 'indices',
      isNormalized: false,
      isBounded: false,
    }),
    material: registry.getMaterialIndex(bake.materialIndices[batch.materialSlot] ?? 0),
  })
}

// The mesh's triangles, one glTF primitive per material batch. `bake.matrices` poses the vertices with the bone
// matrices of the batch's transforms; with `bake.isSkinned` each vertex also follows its bone as a joint.
export const addMeshPrimitives = (
  builder: GltfBuilder,
  registry: MaterialRegistry,
  mesh: SceneMesh,
  bake: MeshBake
): readonly GltfPrimitive[] =>
  mesh.drawBatches.map((batch) => addBatchPrimitive(builder, registry, mesh, batch, bake))

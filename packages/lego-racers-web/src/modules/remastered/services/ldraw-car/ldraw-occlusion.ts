import {
  Box3,
  BufferAttribute,
  ClampToEdgeWrapping,
  Data3DTexture,
  LinearFilter,
  Matrix3,
  Mesh,
  RedFormat,
  UnsignedByteType,
  Vector3,
} from 'three'
import type { BufferGeometry, Object3D, Matrix4 } from 'three'
import type {
  GeometryMesh,
  ModelMesh,
  OcclusionGrid,
  OcclusionVolume,
} from './ldraw-occlusion.types.ts'

export const OCCLUSION_POSITION_ATTRIBUTE = 'occlusionPosition'
export const OCCLUSION_NORMAL_ATTRIBUTE = 'occlusionNormal'

const LONGEST_SIDE_CELLS = 64
const PADDING_CELLS = 8
const SAMPLE_SPACING_CELLS = 0.6
const MAXIMUM_SAMPLES_PER_EDGE = 48

const getIsGeometryMesh = (object: Object3D): object is GeometryMesh => object instanceof Mesh

// A mesh's positions and normals in the model's frame (the meshes of a loaded LDraw part carry their own matrices).
const getModelMesh = (mesh: GeometryMesh, inverseRoot: Matrix4): ModelMesh | null => {
  if (!mesh.geometry.hasAttribute('position') || !mesh.geometry.hasAttribute('normal')) return null
  const position = mesh.geometry.getAttribute('position')
  const normal = mesh.geometry.getAttribute('normal')
  const matrix = inverseRoot.clone().multiply(mesh.matrixWorld)
  const normalMatrix = new Matrix3().getNormalMatrix(matrix)
  const positions = new Float32Array(position.count * 3)
  const normals = new Float32Array(position.count * 3)
  const vector = new Vector3()
  for (let index = 0; index < position.count; index++) {
    vector
      .fromBufferAttribute(position, index)
      .applyMatrix4(matrix)
      .toArray(positions, index * 3)
    vector.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize()
    vector.toArray(normals, index * 3)
  }
  return { geometry: mesh.geometry, positions, normals }
}

const getTriangleCorners = (geometry: BufferGeometry): readonly number[] => {
  const index = geometry.getIndex()
  if (index !== null) return Array.from(index.array)
  return Array.from({ length: geometry.getAttribute('position').count }, (_, corner) => corner)
}

const markTriangle = (
  corners: readonly [Vector3, Vector3, Vector3],
  cell: number,
  mark: (point: Vector3) => void
) => {
  const [first, second, third] = corners
  const firstEdge = second.clone().sub(first)
  const secondEdge = third.clone().sub(first)
  const longest = Math.max(firstEdge.length(), secondEdge.length(), second.distanceTo(third))
  const steps = Math.min(
    MAXIMUM_SAMPLES_PER_EDGE,
    Math.max(1, Math.ceil(longest / (cell * SAMPLE_SPACING_CELLS)))
  )
  const point = new Vector3()
  for (let along = 0; along <= steps; along++) {
    for (let across = 0; across + along <= steps; across++) {
      point
        .copy(first)
        .addScaledVector(firstEdge, along / steps)
        .addScaledVector(secondEdge, across / steps)
      mark(point)
    }
  }
}

// One box blur along each axis: the shell is one cell thick and aliased on slopes, and a lookup should see a soft density.
const blurVolume = (source: Uint8Array, counts: Vector3): Uint8Array => {
  const strides = [1, counts.x, counts.x * counts.y]
  const lengths = [counts.x, counts.y, counts.z]
  let current = source
  for (let axis = 0; axis < 3; axis++) {
    const next = new Uint8Array(source.length)
    const stride = strides[axis] ?? 1
    const length = lengths[axis] ?? 1
    for (let index = 0; index < source.length; index++) {
      const position = Math.floor(index / stride) % length
      const before = position > 0 ? (current[index - stride] ?? 0) : 0
      const after = position < length - 1 ? (current[index + stride] ?? 0) : 0
      next[index] = Math.min(255, ((current[index] ?? 0) * 2 + before + after) * 0.6)
    }
    current = next
  }
  return current
}

// Bakes the model's surface into a grid and gives each mesh the position and normal of its vertices in the model's frame, which
// is what the plastic's shader needs to look up the grid. Null when the model has no mesh. Plain data, so it can run in a worker.
export const bakeOcclusionGrid = (model: Object3D): OcclusionGrid | null => {
  model.updateMatrixWorld(true)
  const inverseRoot = model.matrixWorld.clone().invert()
  const meshes: ModelMesh[] = []
  model.traverse((child) => {
    if (!getIsGeometryMesh(child)) return
    const modelMesh = getModelMesh(child, inverseRoot)
    if (modelMesh !== null) meshes.push(modelMesh)
  })
  const bounds = new Box3()
  const vector = new Vector3()
  for (const { positions } of meshes) {
    for (let offset = 0; offset < positions.length; offset += 3) {
      bounds.expandByPoint(vector.fromArray(positions, offset))
    }
  }
  if (bounds.isEmpty()) return null
  const extent = bounds.getSize(new Vector3())
  const cell = Math.max(extent.x, extent.y, extent.z) / LONGEST_SIDE_CELLS
  const origin = bounds.min.clone().subScalar(cell * PADDING_CELLS)
  const counts = extent
    .clone()
    .divideScalar(cell)
    .ceil()
    .addScalar(PADDING_CELLS * 2 + 1)
  const data = new Uint8Array(counts.x * counts.y * counts.z)
  const mark = (point: Vector3) => {
    const x = Math.floor((point.x - origin.x) / cell)
    const y = Math.floor((point.y - origin.y) / cell)
    const z = Math.floor((point.z - origin.z) / cell)
    data[x + y * counts.x + z * counts.x * counts.y] = 255
  }
  for (const { geometry, positions, normals } of meshes) {
    const corners = getTriangleCorners(geometry)
    for (let corner = 0; corner + 2 < corners.length; corner += 3) {
      markTriangle(
        [
          new Vector3().fromArray(positions, (corners[corner] ?? 0) * 3),
          new Vector3().fromArray(positions, (corners[corner + 1] ?? 0) * 3),
          new Vector3().fromArray(positions, (corners[corner + 2] ?? 0) * 3),
        ],
        cell,
        mark
      )
    }
    geometry.setAttribute(OCCLUSION_POSITION_ATTRIBUTE, new BufferAttribute(positions, 3))
    geometry.setAttribute(OCCLUSION_NORMAL_ATTRIBUTE, new BufferAttribute(normals, 3))
  }
  return Object.freeze({
    data: blurVolume(data, counts),
    counts: counts.toArray(),
    origin: origin.toArray(),
    size: counts.clone().multiplyScalar(cell).toArray(),
    cell,
  })
}

// The grid as the texture the plastic's shader samples.
export const createOcclusionVolume = (grid: OcclusionGrid): OcclusionVolume => {
  const [countX, countY, countZ] = grid.counts
  const texture = new Data3DTexture(grid.data, countX, countY, countZ)
  texture.format = RedFormat
  texture.type = UnsignedByteType
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.wrapR = ClampToEdgeWrapping
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  return Object.freeze({
    texture,
    origin: new Vector3(...grid.origin),
    size: new Vector3(...grid.size),
    cell: grid.cell,
  })
}

export const bakeOcclusionVolume = (model: Object3D): OcclusionVolume | null => {
  const grid = bakeOcclusionGrid(model)
  return grid === null ? null : createOcclusionVolume(grid)
}

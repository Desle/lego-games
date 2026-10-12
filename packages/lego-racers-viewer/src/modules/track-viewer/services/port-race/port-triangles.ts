import type {
  DrawState,
  PortTexture,
  WorldTriangle,
  WorldVertex,
} from '@lego-games/lego-racers/presentation-trace'
import type { SceneRenderState } from '@lego-games/lego-racers/scene'
import { Matrix4, Vector3 } from 'three'
import type {
  BufferAttribute,
  DataTexture,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three'
import type { PortTriangles } from './port-triangles.types.ts'

const CORNERS_PER_TRIANGLE = 3
const BYTE_MAXIMUM = 255
const SOURCE_DEPTH = 2

// The nearest named ancestors of a mesh: the instance (or the racer's part) it belongs to.
const getSourceName = (mesh: Mesh, materialName: string): string => {
  const names: string[] = []
  for (let parent: Object3D | null = mesh.parent; parent !== null; parent = parent.parent) {
    if (parent.name !== '') names.push(parent.name)
  }
  return `${names.slice(0, SOURCE_DEPTH).reverse().join('>')}/${materialName}`
}

const getDrawState = (renderState: SceneRenderState, material: Material): DrawState =>
  Object.freeze({
    shading: renderState.shading,
    colorOperation: renderState.colorOperation,
    isAlphaTestEnabled: renderState.isAlphaTestEnabled,
    alphaFunction: renderState.alphaFunction,
    alphaReference: renderState.alphaReference,
    isBlendEnabled: renderState.isBlendEnabled,
    sourceBlend: renderState.sourceBlend,
    destinationBlend: renderState.destinationBlend,
    filter: renderState.filter,
    addressing: renderState.addressing,
    isDepthTestEnabled: material.depthTest,
    isDepthWriteEnabled: material.depthWrite,
  })

const getTextureKey = (
  texture: DataTexture,
  keys: Map<DataTexture, string>,
  textures: Map<string, PortTexture>,
  materialName: string
): string => {
  const known = keys.get(texture)
  if (known !== undefined) return known
  const key = texture.name === '' ? `${materialName}#${String(keys.size)}` : texture.name
  keys.set(texture, key)
  const { data, width, height } = texture.image
  textures.set(key, {
    width,
    height,
    colors: new Uint8Array(
      data?.buffer ?? new ArrayBuffer(0),
      data?.byteOffset ?? 0,
      data?.byteLength ?? 0
    ),
  })
  return key
}

const getVertices = (
  mesh: Mesh,
  matrix: Matrix4,
  triangleIndex: number
): readonly [WorldVertex, WorldVertex, WorldVertex] | null => {
  const position = mesh.geometry.getAttribute('position') as BufferAttribute
  const uv = mesh.geometry.getAttribute('uv') as BufferAttribute
  const color = mesh.geometry.getAttribute('color') as BufferAttribute | undefined
  const point = new Vector3()
  const map = (mesh.material as MeshBasicMaterial).map
  const offset = map?.offset ?? { x: 0, y: 0 }
  const repeat = map?.repeat ?? { x: 1, y: 1 }
  const corners = [0, 1, 2].map((corner): WorldVertex => {
    const index = triangleIndex * CORNERS_PER_TRIANGLE + corner
    point.fromBufferAttribute(position, index).applyMatrix4(matrix)
    return {
      x: point.x,
      y: point.y,
      z: point.z,
      u: uv.getX(index) * repeat.x + offset.x,
      v: uv.getY(index) * repeat.y + offset.y,
      diffuse:
        color === undefined
          ? [BYTE_MAXIMUM, BYTE_MAXIMUM, BYTE_MAXIMUM, BYTE_MAXIMUM]
          : [
              Math.round(color.getX(index) * BYTE_MAXIMUM),
              Math.round(color.getY(index) * BYTE_MAXIMUM),
              Math.round(color.getZ(index) * BYTE_MAXIMUM),
              Math.round(color.getW(index) * BYTE_MAXIMUM),
            ],
    }
  })
  const [first, second, third] = corners
  if (first === undefined || second === undefined || third === undefined) return null
  // A mirrored object (negative determinant) turns its faces inside out; three.js flips the front face for it.
  return matrix.determinant() < 0 ? [third, second, first] : [first, second, third]
}

// Every triangle of the three.js objects in world space, with the texture, the render state and the object it came from:
// what the viewer would hand to WebGL, read without a renderer.
export const getPortWorldTriangles = (roots: readonly Object3D[]): PortTriangles => {
  const triangles: WorldTriangle[] = []
  const textures = new Map<string, PortTexture>()
  const keys = new Map<DataTexture, string>()
  for (const [rootIndex, root] of roots.entries()) {
    root.updateMatrixWorld(true)
    const rootInverse = root.matrixWorld.clone().invert()
    root.traverseVisible((object) => {
      const mesh = object as Mesh
      if (object.type !== 'Mesh') return
      const material = mesh.material as Material
      const renderState = material.userData['renderState'] as SceneRenderState | undefined
      if (renderState === undefined) return
      const map = (material as MeshBasicMaterial).map ?? null
      const textureKey =
        map === null ? null : getTextureKey(map as DataTexture, keys, textures, material.name)
      const state = getDrawState(renderState, material)
      const source = getSourceName(mesh, material.name)
      // A mesh whose draw range is cut (the decals, the particles) shows only the corners in it.
      const count =
        Math.min(mesh.geometry.getAttribute('position').count, mesh.geometry.drawRange.count) /
        CORNERS_PER_TRIANGLE
      for (let triangleIndex = 0; triangleIndex < count; triangleIndex++) {
        const vertices = getVertices(mesh, mesh.matrixWorld, triangleIndex)
        const localVertices = getVertices(
          mesh,
          new Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld),
          triangleIndex
        )
        if (vertices !== null && localVertices !== null) {
          triangles.push({ vertices, localVertices, root: rootIndex, textureKey, state, source })
        }
      }
    })
  }
  return Object.freeze({ triangles, textures })
}

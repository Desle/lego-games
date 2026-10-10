import type { SceneDrawBatch, SceneMesh, SceneRenderState } from '@lego-games/lego-racers/scene'
import { ShadeMode } from '@lego-games/lego-racers/scene'
import { BufferAttribute, BufferGeometry } from 'three'

const OPAQUE = 255
const WHITE = 255

// The diffuse colour Direct3D receives for one vertex under a material (GolDP.dll 0x1000a2c0 and the
// transform variants it selects): constant white with the opacity as alpha for an unmodulated texture,
// else the vertex colour, its alpha replaced by a constant opacity.
const getDiffuseColor = (
  mesh: SceneMesh,
  vertexIndex: number,
  renderState: SceneRenderState
): readonly [number, number, number, number] => {
  const alpha = renderState.diffuseAlpha
  if (renderState.isDiffuseWhite) return [WHITE, WHITE, WHITE, alpha ?? OPAQUE]
  const start = vertexIndex * 4
  const colors = mesh.colors
  if (colors === null) return [WHITE, WHITE, WHITE, alpha ?? OPAQUE]
  return [
    colors[start] ?? WHITE,
    colors[start + 1] ?? WHITE,
    colors[start + 2] ?? WHITE,
    alpha ?? colors[start + 3] ?? OPAQUE,
  ]
}

// One non-indexed geometry per batch. Flat shading gives every corner the first corner's colour, as
// D3DSHADE_FLAT does.
export const createBatchGeometry = (
  mesh: SceneMesh,
  batch: SceneDrawBatch,
  renderState: SceneRenderState
): BufferGeometry => {
  const cornerCount = batch.vertexIndices.length
  const positions = new Float32Array(cornerCount * 3)
  const textureCoordinates = new Float32Array(cornerCount * 2)
  const colors = new Uint8Array(cornerCount * 4)
  const normals = mesh.normals === null ? null : new Float32Array(cornerCount * 3)
  const isFlat = renderState.shading === ShadeMode.FLAT
  for (let corner = 0; corner < cornerCount; corner++) {
    const vertex = batch.vertexIndices[corner] ?? 0
    const colorVertex = isFlat ? (batch.vertexIndices[corner - (corner % 3)] ?? 0) : vertex
    positions.set(mesh.positions.subarray(vertex * 3, vertex * 3 + 3), corner * 3)
    textureCoordinates.set(mesh.textureCoordinates.subarray(vertex * 2, vertex * 2 + 2), corner * 2)
    colors.set(getDiffuseColor(mesh, colorVertex, renderState), corner * 4)
    normals?.set(mesh.normals?.subarray(vertex * 3, vertex * 3 + 3) ?? [], corner * 3)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(textureCoordinates, 2))
  geometry.setAttribute('color', new BufferAttribute(colors, 4, true))
  if (normals !== null) geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.computeBoundingSphere()
  return geometry
}

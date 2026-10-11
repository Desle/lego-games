import type { SceneDrawBatch, SceneMesh, SceneRenderState } from '@lego-games/lego-racers/scene'
import { ShadeMode } from '@lego-games/lego-racers/scene'
import { BufferAttribute, BufferGeometry } from 'three'

const OPAQUE = 255
const WHITE = 255
const DEFAULT_AMBIENT = [WHITE, WHITE, WHITE, OPAQUE] as const

// The diffuse colour Direct3D receives for one vertex under a material (GolDP.dll 0x1000a2c0 and the
// transform variants it selects): constant white with the opacity as alpha for an unmodulated texture,
// else the vertex colour, its alpha replaced by a constant opacity.
const getDiffuseColor = (
  mesh: SceneMesh,
  vertexIndex: number,
  renderState: SceneRenderState,
  ambientColor: readonly [number, number, number, number]
): readonly [number, number, number, number] => {
  const alpha = renderState.diffuseAlpha
  if (renderState.isDiffuseWhite) return [WHITE, WHITE, WHITE, alpha ?? OPAQUE]
  const start = vertexIndex * 4
  const colors = mesh.colors
  if (colors === null) {
    if (mesh.normals === null) return [WHITE, WHITE, WHITE, alpha ?? OPAQUE]
    const [red, green, blue, ambientAlpha] = getAmbientDiffuse(ambientColor)
    return [red, green, blue, alpha ?? ambientAlpha]
  }
  return [
    colors[start] ?? WHITE,
    colors[start + 1] ?? WHITE,
    colors[start + 2] ?? WHITE,
    alpha ?? colors[start + 3] ?? OPAQUE,
  ]
}

// A model with normals and no vertex colours is lit by the device on the CPU (GolDP.dll 0x1000d760 and its siblings call the
// light function chosen by the light count, table 0x1005c8a8). A race adds no light (the count at device +0x11c stays 0 and the
// world ambient bytes at +0xc856c stay 255), so the function is 0x10011e60: every vertex gets the material's ambient colour
// scaled by the ambient light, (ambient * 255) >> 8 per channel (0x1000a2c0), with the ambient alpha unscaled.
const AMBIENT_LIGHT = 255
const AMBIENT_SHIFT = 8
const getAmbientDiffuse = (
  ambientColor: readonly [number, number, number, number]
): readonly [number, number, number, number] => [
  (ambientColor[0] * AMBIENT_LIGHT) >> AMBIENT_SHIFT,
  (ambientColor[1] * AMBIENT_LIGHT) >> AMBIENT_SHIFT,
  (ambientColor[2] * AMBIENT_LIGHT) >> AMBIENT_SHIFT,
  ambientColor[3],
]

// One non-indexed geometry per batch. Flat shading gives every corner the first corner's colour, as
// D3DSHADE_FLAT does.
export const createBatchGeometry = (
  mesh: SceneMesh,
  batch: SceneDrawBatch,
  renderState: SceneRenderState,
  ambientColor: readonly [number, number, number, number] = DEFAULT_AMBIENT
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
    colors.set(getDiffuseColor(mesh, colorVertex, renderState, ambientColor), corner * 4)
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

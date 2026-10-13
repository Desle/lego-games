import type { DecalTriangle } from '@lego-games/lego-racers/decal'
import { getFloatFromBits } from '@lego-games/lego-racers/simulation-math'
import type { Scene, SceneMaterial } from '@lego-games/lego-racers/scene'
import { BufferAttribute, BufferGeometry, LessEqualDepth, Mesh, type Material } from 'three'
import { createSceneMaterial } from '../scene-object/scene-material.ts'

const POSITION_SIZE = 3
const COORDINATE_SIZE = 2
const COLOR_SIZE = 4
const CORNERS_PER_TRIANGLE = 3
const BYTE_MAXIMUM = 255
// 0x004af914: the decal's instance is moved 0.4 along z when it is made (0x00414950), which lifts it off the track.
const DECAL_LIFT = getFloatFromBits(0x3ecccccd)

// A geometry for `cornerCount` corners that is filled again every frame: positions, picture coordinates and colours.
export const createDynamicGeometry = (cornerCount: number): BufferGeometry => {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(cornerCount * POSITION_SIZE), POSITION_SIZE)
  )
  geometry.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array(cornerCount * COORDINATE_SIZE), COORDINATE_SIZE)
  )
  geometry.setAttribute(
    'color',
    new BufferAttribute(new Uint8Array(cornerCount * COLOR_SIZE), COLOR_SIZE, true)
  )
  geometry.setDrawRange(0, 0)
  return geometry
}

// The material of a decal: drawn under an alpha of its own (the device's override) and with the depth written. The colour
// key (render state 41, recorded on for the decals) stays: the keyed texels of a decal without a blend (the oil slick) are
// not drawn, so the material's alpha test stands in for it as for every material.
export const createDecalMaterial = (scene: Scene, material: SceneMaterial): Material => {
  const three = createSceneMaterial(material, scene.textures, new Map())
  three.depthWrite = true
  three.depthFunc = LessEqualDepth
  return three
}

// A decal's mesh for up to `maximumTriangles` triangles, lifted off the track and drawn after it.
export const createDecalMesh = (material: Material, maximumTriangles: number): Mesh => {
  const mesh = new Mesh(createDynamicGeometry(maximumTriangles * CORNERS_PER_TRIANGLE), material)
  mesh.position.set(0, 0, DECAL_LIFT)
  mesh.frustumCulled = false
  mesh.visible = false
  mesh.renderOrder = 1
  return mesh
}

// Fills a decal's mesh with the triangles of a projection, all with one alpha (0 to 255).
export const setDecalTriangles = (
  mesh: Mesh,
  triangles: readonly DecalTriangle[],
  alpha: number
): void => {
  const positions = mesh.geometry.getAttribute('position') as BufferAttribute
  const coordinates = mesh.geometry.getAttribute('uv') as BufferAttribute
  const colors = mesh.geometry.getAttribute('color') as BufferAttribute
  for (const [triangleIndex, triangle] of triangles.entries()) {
    for (const [cornerIndex, vertex] of triangle.entries()) {
      const corner = triangleIndex * CORNERS_PER_TRIANGLE + cornerIndex
      positions.setXYZ(corner, vertex.x, vertex.y, vertex.z)
      coordinates.setXY(corner, vertex.u, vertex.v)
      colors.setXYZW(corner, 1, 1, 1, alpha / BYTE_MAXIMUM)
    }
  }
  positions.needsUpdate = true
  coordinates.needsUpdate = true
  colors.needsUpdate = true
  mesh.geometry.setDrawRange(0, triangles.length * CORNERS_PER_TRIANGLE)
  // eslint-disable-next-line no-param-reassign -- three.js shows an object by setting its flag
  mesh.visible = triangles.length > 0
}

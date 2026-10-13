import { BufferAttribute, BufferGeometry } from 'three'
import type { Mesh, Object3D } from 'three'

const COMPONENTS_PER_COORDINATE = 2

// The texture coordinates each scrolling geometry was built with.
const baseTextureCoordinates = new WeakMap<BufferGeometry, Float32Array>()

// The mesh's own copy of its geometry (it shares the others with the instances that use the same model), keeping
// every attribute but the texture coordinates.
const getScrollingGeometry = (mesh: Mesh): BufferGeometry => {
  const { geometry } = mesh
  if (baseTextureCoordinates.has(geometry)) return geometry
  const coordinates = geometry.getAttribute('uv') as BufferAttribute
  const scrolling = new BufferGeometry()
  for (const name of Object.keys(geometry.attributes)) {
    scrolling.setAttribute(
      name,
      name === 'uv'
        ? new BufferAttribute(Float32Array.from(coordinates.array), COMPONENTS_PER_COORDINATE)
        : geometry.getAttribute(name)
    )
  }
  scrolling.userData = { ...geometry.userData }
  scrolling.boundingSphere = geometry.boundingSphere?.clone() ?? null
  baseTextureCoordinates.set(scrolling, Float32Array.from(coordinates.array))
  // eslint-disable-next-line no-param-reassign -- the mesh takes its own geometry on its first scroll
  mesh.geometry = scrolling
  return scrolling
}

// GolDP.dll 0x10028030 hands the instance's scroll offsets to the renderer, which adds them to the texture coordinates
// of every vertex it transforms (0x1000c630): u and v of the model plus the offsets, stored as float32.
export const setTextureOffset = (root: Object3D, offsetU: number, offsetV: number): void =>
  root.traverse((object) => {
    if (object.type !== 'Mesh') return
    const mesh = object as Mesh
    if (!baseTextureCoordinates.has(mesh.geometry) && offsetU === 0 && offsetV === 0) return
    const geometry = getScrollingGeometry(mesh)
    const base = baseTextureCoordinates.get(geometry)
    if (base === undefined) return
    const coordinates = geometry.getAttribute('uv') as BufferAttribute
    for (let index = 0; index < base.length; index += COMPONENTS_PER_COORDINATE) {
      coordinates.array[index] = (base[index] ?? 0) + offsetU
      coordinates.array[index + 1] = (base[index + 1] ?? 0) + offsetV
    }
    coordinates.needsUpdate = true
  })

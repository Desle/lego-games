import type { BufferAttribute, BufferGeometry, Mesh, Object3D } from 'three'
import type { ColourShiftLike } from '../race-viewport/race-viewport.types.ts'

const CHANNEL_MAXIMUM = 255
const CHANNEL_COUNT = 4
// The colours each geometry was built with, kept while a shift rewrites its attribute.
const originalColors = new WeakMap<BufferGeometry, Uint8Array>()

// The vertex buffer's colour remap (GolDP.dll 0x10017050): (channel >> shift) + bias per channel, clamped to 255, written
// to a second colour array that replaces the first while it is set. The mesh keeps the colours it was built with.
export const applyColourShift = (geometry: BufferGeometry, shift: ColourShiftLike | null): void => {
  if (geometry.userData['isPrelit'] !== true) return
  const colors = geometry.getAttribute('color') as BufferAttribute
  const original = originalColors.get(geometry) ?? Uint8Array.from(colors.array)
  originalColors.set(geometry, original)
  const target = colors.array as Uint8Array
  for (let index = 0; index < original.length; index++) {
    const channel = index % CHANNEL_COUNT
    const value = original[index] ?? 0
    target[index] =
      shift === null
        ? value
        : Math.min(
            CHANNEL_MAXIMUM,
            (value >> (shift.shifts[channel] ?? 0)) + (shift.biases[channel] ?? 0)
          )
  }
  colors.needsUpdate = true
}

// The geometries of every mesh under an object.
export const getMeshGeometries = (root: Object3D): readonly BufferGeometry[] => {
  const geometries: BufferGeometry[] = []
  root.traverse((object) => {
    if (object.type === 'Mesh') geometries.push((object as Mesh).geometry)
  })
  return geometries
}

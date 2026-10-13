import type { BufferGeometry, Material, Object3D } from 'three'
import { getIsGeometry, getIsMesh } from '../object-guards/object-guards.ts'

// The geometry of the prepared models: every drawing of a model draws it, so only the prepared-model cache frees it.
const sharedGeometries = new WeakSet<BufferGeometry>()

const getGeometries = (object: Object3D): readonly BufferGeometry[] => {
  const geometries: BufferGeometry[] = []
  object.traverse((child) => {
    const geometry: unknown = Reflect.get(child, 'geometry')
    if (getIsGeometry(geometry)) geometries.push(geometry)
  })
  return geometries
}

export const markGeometryShared = (object: Object3D) => {
  for (const geometry of getGeometries(object)) sharedGeometries.add(geometry)
}

const getMeshMaterials = (object: Object3D): ReadonlySet<Material> => {
  const materials = new Set<Material>()
  object.traverse((child) => {
    if (!getIsMesh(child)) return
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      materials.add(material)
    }
  })
  return materials
}

// Frees what an object's meshes own: their geometries (not a prepared model's, which other drawings share) and their materials, once
// each however many meshes share them.
export const disposeObject = (object: Object3D) => {
  object.traverse((child) => {
    if (getIsMesh(child) && !sharedGeometries.has(child.geometry)) child.geometry.dispose()
  })
  for (const material of getMeshMaterials(object)) material.dispose()
}

// Frees a prepared model the cache lets go: every geometry, the lines' too, and its meshes' materials (the lines' are shared by colour).
export const disposeSharedObject = (object: Object3D) => {
  for (const geometry of getGeometries(object)) geometry.dispose()
  for (const material of getMeshMaterials(object)) material.dispose()
}

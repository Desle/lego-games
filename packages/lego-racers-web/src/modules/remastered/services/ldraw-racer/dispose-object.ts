import { Mesh } from 'three'
import type { Material, Object3D } from 'three'

const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

// Frees the geometries and materials of an object's meshes (shared ones once).
export const disposeObject = (object: Object3D) => {
  const materials = new Set<Material>()
  object.traverse((child) => {
    if (!getIsMesh(child)) return
    child.geometry.dispose()
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      materials.add(material)
    }
  })
  for (const material of materials) material.dispose()
}

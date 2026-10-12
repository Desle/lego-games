import { Mesh } from 'three'
import type { Material, Object3D } from 'three'

const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

const getMeshes = (object: Object3D): readonly Mesh[] => {
  const meshes: Mesh[] = []
  object.traverse((child) => {
    if (getIsMesh(child)) meshes.push(child)
  })
  return meshes
}

// Frees what an object's meshes hold: their geometries, and their materials once each however many meshes share them.
export const disposeObject = (object: Object3D) => {
  const meshes = getMeshes(object)
  const materials = new Set<Material>(
    meshes.flatMap((mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
  )
  for (const mesh of meshes) mesh.geometry.dispose()
  for (const material of materials) material.dispose()
}

import type { Material, Object3D } from 'three'
import { getIsMesh } from '@lego-games/ldraw/geometry'

const OPAQUE = 1

const setMaterialOpacity = (material: Material, opacity: number) =>
  Object.assign(material, {
    transparent: opacity < OPAQUE,
    opacity,
    depthWrite: opacity >= OPAQUE,
  })

const setMeshOpacity = (object: Object3D, opacity: number) => {
  if (!getIsMesh(object)) return
  const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material]
  for (const material of materials) setMaterialOpacity(material, opacity)
}

// Draws the meshes of an object at an opacity (a ghost's); each drawing owns its materials, so nothing else changes. Edge lines keep
// theirs.
export const setDrawingOpacity = (object: Object3D, opacity: number) =>
  object.traverse((child) => setMeshOpacity(child, opacity))

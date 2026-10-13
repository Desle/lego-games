import type { Material, Object3D } from 'three'
import { getIsMesh } from '@lego-games/ldraw/geometry'
import type { MaterialBase } from './drawing-opacity.types.ts'

const OPAQUE = 1

// What each material was before any drawing faded it: a translucent brick keeps its own see-through.
const materialBases = new WeakMap<Material, MaterialBase>()

const getMaterialBase = (material: Material): MaterialBase => {
  const existing = materialBases.get(material)
  if (existing !== undefined) return existing
  const base = Object.freeze({
    opacity: material.opacity,
    isTransparent: material.transparent,
    isDepthWritten: material.depthWrite,
  })
  materialBases.set(material, base)
  return base
}

const setMaterialOpacity = (material: Material, opacity: number) => {
  const base = getMaterialBase(material)
  const isFaded = opacity < OPAQUE
  Object.assign(material, {
    transparent: base.isTransparent || isFaded,
    opacity: base.opacity * opacity,
    depthWrite: isFaded ? false : base.isDepthWritten,
  })
}

const setMeshOpacity = (object: Object3D, opacity: number) => {
  if (!getIsMesh(object)) return
  const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material]
  for (const material of materials) setMaterialOpacity(material, opacity)
}

// Draws the meshes of an object at an opacity (a ghost's) times each material's own; each drawing owns its materials, so nothing
// else changes. Edge lines keep theirs.
export const setDrawingOpacity = (object: Object3D, opacity: number) =>
  object.traverse((child) => setMeshOpacity(child, opacity))

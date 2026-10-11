import { linkMaterials } from './link-materials.ts'
import { linkTextures } from './link-textures.ts'
import type { LinkedModelResources, SceneFileSource } from './load-scene.types.ts'

// The texture databases, then the material libraries of a loose model, the way a world loads them
// (GolDP.dll 0x10017ac0), starting from empty chains.
export const linkModelResources = (
  source: SceneFileSource,
  textureNames: readonly string[],
  materialNames: readonly string[]
): LinkedModelResources => {
  const textures = linkTextures(source, textureNames, {
    textures: [],
    indexByName: new Map(),
  })
  const materials = linkMaterials(source, materialNames, textures, {
    materials: [],
    indexByName: new Map(),
  })
  return { textures, materials }
}

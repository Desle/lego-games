import { linkMaterials } from './link-materials.ts'
import { linkTextures } from './link-textures.ts'
import type { LinkedModelResources, SceneFileSource } from './load-scene.types.ts'
import type { Scene } from '../../types/scene.types.ts'

// The texture databases, then the material libraries of a loose model, the way a world loads them
// (GolDP.dll 0x10017ac0), on top of the chains of the container they are loaded into (`earlier`, the race's worlds and the
// models loaded before): a texture name registered before keeps its texture, a material name resolves to the newest.
export const linkModelResources = (
  source: SceneFileSource,
  textureNames: readonly string[],
  materialNames: readonly string[],
  earlier: Scene | null
): LinkedModelResources => {
  const textures = linkTextures(source, textureNames, {
    textures: earlier?.textures ?? [],
    indexByName: new Map((earlier?.textures ?? []).map((texture, index) => [texture.name, index])),
  })
  const materials = linkMaterials(source, materialNames, textures, {
    materials: earlier?.materials ?? [],
    indexByName: new Map(
      (earlier?.materials ?? []).map((material, index) => [material.name, index])
    ),
  })
  return { textures, materials }
}

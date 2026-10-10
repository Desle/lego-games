import { parseMaterialLibrary } from '../../../material/index.ts'
import type { Material } from '../../../material/index.ts'
import { getRenderState } from '../../types/render-state/render-state.ts'
import { SceneLinkError } from '../../types/scene-errors/scene-errors.ts'
import { getArchivePath, getNameWithDefaultExtension } from '../../types/scene-path/scene-path.ts'
import type { SceneMaterial } from '../../types/scene.types.ts'
import type { LinkedMaterials, LinkedTextures, SceneFileSource } from './load-scene.types.ts'

// 0x10017ac0 appends ".mdf" (0x1005cbcc); the reader's default extension ".mdb" (0x1005ceac) replaces it.
const MATERIAL_LIST_EXTENSION = '.mdf'
const MATERIAL_LIBRARY_EXTENSION = '.mdb'

const getLinkedMaterial = (
  material: Material,
  libraryPath: string,
  linkedTextures: LinkedTextures
): SceneMaterial => {
  const textureIndex =
    material.textureName === null ? null : linkedTextures.indexByName.get(material.textureName)
  if (textureIndex === undefined) {
    throw new SceneLinkError(
      `Mat def file references unknown texture: ${material.textureName ?? ''}`
    )
  }
  const texture = textureIndex === null ? null : linkedTextures.textures[textureIndex]
  return Object.freeze({
    name: material.name,
    libraryPath,
    flags: material.flags,
    textureIndex,
    ambientColor: material.ambientColor,
    diffuseColor: material.diffuseColor,
    renderState: getRenderState({
      flags: material.flags,
      alphaFunction: material.alphaFunction,
      alphaReference: material.alphaReference,
      sourceBlend: material.sourceBlend,
      destinationBlendOrOpacity: material.destinationBlendOrOpacity,
      textureFlags: texture?.flags ?? null,
    }),
  })
}

// GolDP.dll 0x10026270 for each name in the world's material list, in order. Each library is linked at the
// head of the world's chain (0x10028bc0) and a lookup (0x10028c20) walks it from the head, so a name a later
// library also defines resolves to the later one.
export const linkMaterials = (
  source: SceneFileSource,
  libraryNames: readonly string[],
  linkedTextures: LinkedTextures,
  earlier: LinkedMaterials
): LinkedMaterials => {
  const materials: SceneMaterial[] = [...earlier.materials]
  const indexByName = new Map(earlier.indexByName)
  for (const libraryName of libraryNames) {
    const path = getArchivePath(
      source.directory,
      getNameWithDefaultExtension(libraryName + MATERIAL_LIST_EXTENSION, MATERIAL_LIBRARY_EXTENSION)
    )
    for (const material of parseMaterialLibrary(source.archive.readFile(path)).materials) {
      indexByName.set(material.name, materials.length)
      materials.push(getLinkedMaterial(material, path, linkedTextures))
    }
  }
  return Object.freeze({ materials: Object.freeze(materials), indexByName })
}

// GolDP.dll 0x10025f90: each model material name (first eight characters) is looked up in the chain.
export const getMaterialIndices = (
  linkedMaterials: LinkedMaterials,
  materialNames: readonly string[]
): readonly number[] =>
  Object.freeze(
    materialNames.map((name) => {
      const index = linkedMaterials.indexByName.get(name.slice(0, 8))
      if (index === undefined) throw new SceneLinkError(`${name}: Material assignment failed`)
      return index
    })
  )

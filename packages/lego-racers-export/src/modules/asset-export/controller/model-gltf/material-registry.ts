import { CompareFunction, TextureAddressing, TextureFilter } from '@lego-games/lego-racers/scene'
import type { Scene, SceneMaterial, SceneTexture } from '@lego-games/lego-racers/scene'
import type {
  GltfBuilder,
  GltfMaterialSource,
} from '../../services/gltf-builder/gltf-builder.types.ts'
import type { MaterialRegistry } from './material-registry.types.ts'
import { getHasTransparentPixels } from './texture-references.ts'
import type { TextureUriResolver } from './texture-references.types.ts'

const FILTER_NEAREST = 9728
const FILTER_LINEAR = 9729
const WRAP_REPEAT = 10497
const WRAP_CLAMP_TO_EDGE = 33071
const COLOR_RANGE = 255
const KEYED_ALPHA_CUTOFF = 0.5
const WHITE = Object.freeze([1, 1, 1, 1] as const)

const getAlphaMode = (
  material: SceneMaterial,
  texture: SceneTexture | null
): Pick<GltfMaterialSource, 'alphaMode' | 'alphaCutoff'> => {
  const { renderState } = material
  const isAlphaTested =
    renderState.isAlphaTestEnabled && renderState.alphaFunction !== CompareFunction.ALWAYS
  if (isAlphaTested) {
    return { alphaMode: 'MASK', alphaCutoff: Math.max(renderState.alphaReference, 1) / COLOR_RANGE }
  }
  if (renderState.isBlendEnabled) return { alphaMode: 'BLEND', alphaCutoff: 0 }
  const isKeyed = texture?.bitmap != null && getHasTransparentPixels(texture.bitmap)
  return isKeyed
    ? { alphaMode: 'MASK', alphaCutoff: KEYED_ALPHA_CUTOFF }
    : { alphaMode: 'OPAQUE', alphaCutoff: 0 }
}

const getBaseColorFactor = (material: SceneMaterial, isTextured: boolean) =>
  isTextured
    ? WHITE
    : (material.diffuseColor.map((value) =>
        Math.min(Math.max(value / COLOR_RANGE, 0), 1)
      ) as unknown as GltfMaterialSource['baseColorFactor'])

// glTF materials of a scene's materials, created on first use. A material's picture is referenced by the URI
// `getTextureUri` gives.
export const createMaterialRegistry = (
  builder: GltfBuilder,
  scene: Scene,
  getTextureUri: TextureUriResolver
): MaterialRegistry => {
  const imageByUri = new Map<string, number>()
  const samplerByKey = new Map<string, number>()
  const textureByKey = new Map<string, number>()
  const materialByIndex = new Map<number, number>()
  const getImageIndex = (uri: string): number => {
    const existing = imageByUri.get(uri)
    if (existing !== undefined) return existing
    const created = builder.addImage(uri)
    imageByUri.set(uri, created)
    return created
  }
  const getSamplerIndex = (material: SceneMaterial): number => {
    const { filter, addressing } = material.renderState
    const key = `${filter}/${addressing}`
    const existing = samplerByKey.get(key)
    if (existing !== undefined) return existing
    const filterValue = filter === TextureFilter.POINT ? FILTER_NEAREST : FILTER_LINEAR
    const wrap = addressing === TextureAddressing.CLAMP ? WRAP_CLAMP_TO_EDGE : WRAP_REPEAT
    const created = builder.addSampler({
      magnificationFilter: filterValue,
      minificationFilter: filterValue,
      wrapS: wrap,
      wrapT: wrap,
    })
    samplerByKey.set(key, created)
    return created
  }
  const getTextureIndex = (material: SceneMaterial, uri: string): number => {
    const sampler = getSamplerIndex(material)
    const key = `${uri}|${String(sampler)}`
    const existing = textureByKey.get(key)
    if (existing !== undefined) return existing
    const created = builder.addTexture(getImageIndex(uri), sampler)
    textureByKey.set(key, created)
    return created
  }
  const createMaterial = (material: SceneMaterial): number => {
    const texture =
      material.textureIndex === null ? null : (scene.textures[material.textureIndex] ?? null)
    const uri = texture === null ? null : getTextureUri(texture)
    return builder.addMaterial({
      name: material.name,
      baseColorFactor: getBaseColorFactor(material, uri !== null),
      baseColorTexture: uri === null ? null : getTextureIndex(material, uri),
      ...getAlphaMode(material, uri === null ? null : texture),
    })
  }
  return Object.freeze({
    getMaterialIndex: (sceneMaterialIndex) => {
      const existing = materialByIndex.get(sceneMaterialIndex)
      if (existing !== undefined) return existing
      const sceneMaterial = scene.materials[sceneMaterialIndex]
      const created = createMaterial(sceneMaterial ?? (scene.materials[0] as SceneMaterial))
      materialByIndex.set(sceneMaterialIndex, created)
      return created
    },
  })
}

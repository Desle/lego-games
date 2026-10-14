import type { Object3D } from 'three'
import {
  EFFECT_MODEL_NAMES,
  POSED_BONE_KEY,
} from '../../../../shared/viewer-extensions/effect-model-names.ts'
import { PARTICLE_MATERIAL_NAME_KEY } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { EffectElement, LayerEffectReader } from './effect-sweep-census.types.ts'

// The warp's tunnel is a world of its own (0x0045d940 draws TURBO3.WDB), not a model of POWERUP.WDB.
const WARP_WORLD_PATTERN = /TURBO3\.WDB$/i

const getStem = (path: string): string =>
  (path.split('\\').at(-1) ?? '').replace(/\.[^.]*$/, '').toUpperCase()

const getHasVisibleMesh = (object: Object3D): boolean =>
  object.visible &&
  (('isMesh' in object && object.isMesh === true) || object.children.some(getHasVisibleMesh))

const getPartCount = (drawing: Object3D): number =>
  Math.max(
    1,
    drawing.children.filter((child) => typeof child.userData[POSED_BONE_KEY] === 'number').length
  )

const getOriginalElement = (object: Object3D): Omit<EffectElement, 'object'> | null => {
  const particleMaterial: unknown = object.userData[PARTICLE_MATERIAL_NAME_KEY]
  if (typeof particleMaterial === 'string')
    return {
      origin: 'original',
      kind: 'particle',
      key: particleMaterial,
      isEmpty: false,
      partCount: 1,
    }
  const meshPath: unknown = object.userData['meshPath']
  const worldPath: unknown = object.userData['worldPath']
  if (typeof meshPath !== 'string' || typeof worldPath !== 'string') return null
  const stem = getStem(meshPath)
  if (EFFECT_MODEL_NAMES.includes(stem))
    return { origin: 'original', kind: 'model', key: stem, isEmpty: false, partCount: 1 }
  return WARP_WORLD_PATTERN.test(worldPath)
    ? { origin: 'original', kind: 'world', key: object.name, isEmpty: false, partCount: 1 }
    : null
}

// Every effect element a scene would draw now: the layer's effect drawings (by the model or material asked for), the original's
// effect models (by their mesh file), particle quads (by material) and the warp world's instances. Hidden objects and everything
// below them are skipped, as the renderer skips them; an original element counts only when it has a visible mesh.
export const findEffectElements = (
  scene: Object3D,
  getLayerEffect: LayerEffectReader
): readonly EffectElement[] => {
  const elements: EffectElement[] = []
  const visit = (object: Object3D) => {
    if (!object.visible) return
    const layerEffect = getLayerEffect(object)
    if (layerEffect !== null) {
      const isEmpty = !getHasVisibleMesh(object)
      elements.push({
        origin: 'layer',
        ...layerEffect,
        object,
        isEmpty,
        partCount: isEmpty ? 0 : getPartCount(object),
      })
      return
    }
    const original = getOriginalElement(object)
    if (original !== null) {
      if (getHasVisibleMesh(object)) elements.push({ ...original, object })
      return
    }
    object.children.forEach(visit)
  }
  visit(scene)
  return elements
}

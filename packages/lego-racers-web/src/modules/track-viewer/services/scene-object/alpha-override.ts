import { BlendFactor } from '@lego-games/lego-racers/scene'
import type { SceneRenderState } from '@lego-games/lego-racers/scene'
import { CustomBlending, OneMinusSrcAlphaFactor, SrcAlphaFactor } from 'three'
import type { BufferAttribute, BufferGeometry, Material, Mesh, Object3D } from 'three'
import { KEPT_SURFACE_ALPHA } from './scene-material.ts'
import type { AlphaOverrideOriginal } from './alpha-override.types.ts'

const CHANNEL_MAXIMUM = 255
const CHANNEL_COUNT = 4
const ALPHA_CHANNEL = 3
const originalGeometries = new WeakMap<BufferGeometry, Uint8Array>()
const originalMaterials = new WeakMap<Material, AlphaOverrideOriginal>()

const setGeometryAlpha = (geometry: BufferGeometry, alpha: number | null): void => {
  const colors = geometry.getAttribute('color') as BufferAttribute | undefined
  if (colors === undefined) return
  const target = colors.array as Uint8Array
  const original = originalGeometries.get(geometry) ?? Uint8Array.from(target)
  originalGeometries.set(geometry, original)
  for (let index = ALPHA_CHANNEL; index < original.length; index += CHANNEL_COUNT) {
    target[index] = alpha ?? original[index] ?? CHANNEL_MAXIMUM
  }
  colors.needsUpdate = true
}

const setMaterialOverride = (material: Material, isOverridden: boolean): void => {
  const known = originalMaterials.get(material)
  const original: AlphaOverrideOriginal = known ?? {
    blending: material.blending,
    blendSrc: material.blendSrc,
    blendDst: material.blendDst,
    blendSrcAlpha: material.blendSrcAlpha,
    blendDstAlpha: material.blendDstAlpha,
    isTransparent: material.transparent,
    renderState: material.userData['renderState'] as SceneRenderState | undefined,
  }
  originalMaterials.set(material, original)
  if (!isOverridden) {
    Object.assign(material, {
      blending: original.blending,
      blendSrc: original.blendSrc,
      blendDst: original.blendDst,
      blendSrcAlpha: original.blendSrcAlpha,
      blendDstAlpha: original.blendDstAlpha,
      transparent: original.isTransparent,
    })
    Object.assign(material.userData, { renderState: original.renderState })
    return
  }
  Object.assign(material, {
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    ...KEPT_SURFACE_ALPHA,
    transparent: true,
  })
  if (original.renderState !== undefined) {
    Object.assign(material.userData, {
      renderState: {
        ...original.renderState,
        isBlendEnabled: true,
        sourceBlend: BlendFactor.SOURCE_ALPHA,
        destinationBlend: BlendFactor.INVERSE_SOURCE_ALPHA,
      },
    })
  }
}

// The device's alpha override (GolDP.dll slot 0xb8 with mode 1, cleared by slot 0xbc): every vertex drawn takes this alpha
// (0..255) and the blend is source alpha over inverse source alpha. null takes the override off again.
export const setAlphaOverride = (root: Object3D, alpha: number | null): void =>
  root.traverse((object) => {
    if (object.type !== 'Mesh') return
    const mesh = object as Mesh
    setGeometryAlpha(mesh.geometry, alpha)
    setMaterialOverride(mesh.material as Material, alpha !== null)
  })

const ownMaterials = new WeakSet<Material>()

// A copy of a material for one mesh, keeping the alpha test code the scene material compiles with.
const getOwnMaterial = (material: Material): Material => {
  if (ownMaterials.has(material)) return material
  const copy = material.clone()
  copy.onBeforeCompile = (shader, renderer) => material.onBeforeCompile(shader, renderer)
  copy.customProgramCacheKey = () => material.customProgramCacheKey()
  ownMaterials.add(copy)
  return copy
}

// The device's alpha override on one instance of a scene: the instance's meshes take materials of their own first, as the
// scene's materials are shared by every instance that uses them.
export const setInstanceAlphaOverride = (root: Object3D, alpha: number | null): void => {
  root.traverse((object) => {
    if (object.type !== 'Mesh') return
    const mesh = object as Mesh
    mesh.material = getOwnMaterial(mesh.material as Material)
  })
  setAlphaOverride(root, alpha)
}

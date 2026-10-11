import type {
  BlendFactorValue,
  CompareFunctionValue,
  SceneMaterial,
  SceneMesh,
  SceneTexture,
} from '@lego-games/lego-racers/scene'
import {
  BlendFactor,
  CompareFunction,
  TextureAddressing,
  TextureFilter,
} from '@lego-games/lego-racers/scene'
import {
  ClampToEdgeWrapping,
  Color,
  CustomBlending,
  DataTexture,
  FrontSide,
  LinearFilter,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  NoColorSpace,
  NoBlending,
  RepeatWrapping,
  RGBAFormat,
} from 'three'
import type { BlendingDstFactor, BlendingSrcFactor, Material } from 'three'
import {
  DstAlphaFactor,
  DstColorFactor,
  OneFactor,
  OneMinusDstAlphaFactor,
  OneMinusDstColorFactor,
  OneMinusSrcAlphaFactor,
  OneMinusSrcColorFactor,
  SrcAlphaFactor,
  SrcAlphaSaturateFactor,
  SrcColorFactor,
  ZeroFactor,
} from 'three'
import type { BlendingParameters, TextureCache } from './scene-object.types.ts'

// D3DBLEND → WebGL; SRCALPHASAT is only valid as a source factor in both APIs.
const BLEND_FACTORS: Readonly<Record<BlendFactorValue, BlendingSrcFactor>> = {
  [BlendFactor.ZERO]: ZeroFactor,
  [BlendFactor.ONE]: OneFactor,
  [BlendFactor.SOURCE_COLOR]: SrcColorFactor,
  [BlendFactor.DESTINATION_COLOR]: DstColorFactor,
  [BlendFactor.INVERSE_SOURCE_COLOR]: OneMinusSrcColorFactor,
  [BlendFactor.INVERSE_DESTINATION_COLOR]: OneMinusDstColorFactor,
  [BlendFactor.SOURCE_ALPHA]: SrcAlphaFactor,
  [BlendFactor.DESTINATION_ALPHA]: DstAlphaFactor,
  [BlendFactor.INVERSE_SOURCE_ALPHA]: OneMinusSrcAlphaFactor,
  [BlendFactor.INVERSE_DESTINATION_ALPHA]: OneMinusDstAlphaFactor,
  [BlendFactor.SOURCE_ALPHA_SATURATE]: SrcAlphaSaturateFactor,
}

// D3DCMPFUNC as a GLSL condition that keeps the fragment; the alpha is compared in 0..255 like the device.
const ALPHA_CONDITIONS: Readonly<Record<CompareFunctionValue, string>> = {
  [CompareFunction.ALWAYS]: 'true',
  [CompareFunction.EQUAL]: 'alphaByte == alphaReference',
  [CompareFunction.GREATER]: 'alphaByte > alphaReference',
  [CompareFunction.GREATER_EQUAL]: 'alphaByte >= alphaReference',
  [CompareFunction.LESS]: 'alphaByte < alphaReference',
  [CompareFunction.LESS_EQUAL]: 'alphaByte <= alphaReference',
  [CompareFunction.NEVER]: 'false',
  [CompareFunction.NOT_EQUAL]: 'alphaByte != alphaReference',
}

const getTextureKey = (textureIndex: number, material: SceneMaterial) =>
  `${String(textureIndex)}/${material.renderState.filter}/${material.renderState.addressing}`

// The device samples with the material's filter and addressing (D3DTSS_MAGFILTER/MINFILTER/ADDRESS) and
// no mip-mapping; colours pass through without colour management, as Direct3D 6 does.
const getTexture = (
  textures: readonly SceneTexture[],
  textureIndex: number | null,
  material: SceneMaterial,
  cache: TextureCache
): DataTexture | null => {
  const bitmap = textureIndex === null ? null : (textures[textureIndex]?.bitmap ?? null)
  if (textureIndex === null || bitmap === null) return null
  const key = getTextureKey(textureIndex, material)
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const texture = new DataTexture(bitmap.colors, bitmap.width, bitmap.height, RGBAFormat)
  const filter = material.renderState.filter === TextureFilter.POINT ? NearestFilter : LinearFilter
  const wrapping =
    material.renderState.addressing === TextureAddressing.CLAMP
      ? ClampToEdgeWrapping
      : RepeatWrapping
  texture.magFilter = filter
  texture.minFilter = filter
  texture.wrapS = wrapping
  texture.wrapT = wrapping
  texture.generateMipmaps = false
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  cache.set(key, texture)
  return texture
}

// The fragment code replacing three.js's alpha test (`alpha < alphaTest` discards) with the material's D3D
// compare function, or null when alpha testing is off.
const getAlphaTestCode = (sceneMaterial: SceneMaterial): string | null => {
  const { renderState } = sceneMaterial
  if (!renderState.isAlphaTestEnabled) return null
  return [
    'float alphaByte = floor(diffuseColor.a * 255.0 + 0.5);',
    `float alphaReference = ${renderState.alphaReference.toFixed(1)};`,
    `if (!(${ALPHA_CONDITIONS[renderState.alphaFunction]})) discard;`,
  ].join('\n')
}

const getBlendingParameters = (sceneMaterial: SceneMaterial): BlendingParameters => {
  const { renderState } = sceneMaterial
  if (!renderState.isBlendEnabled) return { blending: NoBlending, transparent: false }
  return {
    blending: CustomBlending,
    blendSrc: BLEND_FACTORS[renderState.sourceBlend],
    blendDst: BLEND_FACTORS[renderState.destinationBlend] as BlendingDstFactor,
    transparent: true,
  }
}

// The device state of GolDP.dll 0x1000a2c0 for one material. Prelit models (vertex colours) draw unlit
// with the vertex colour as the diffuse colour; the engine's lighting of models with normals is not
// ported, so those use three.js Lambert lighting with the material's diffuse colour.
export const createSceneMaterial = (
  sceneMaterial: SceneMaterial,
  mesh: SceneMesh,
  textures: readonly SceneTexture[],
  cache: TextureCache
): Material => {
  const [red, green, blue] = sceneMaterial.diffuseColor
  const parameters = {
    map: getTexture(textures, sceneMaterial.textureIndex, sceneMaterial, cache),
    vertexColors: true,
    // 0x1000ebd0 culls in screen space: it draws a face only when its corners turn counter-clockwise on
    // screen, which is three.js's front face for the same world, so only front faces are drawn.
    side: FrontSide,
    name: sceneMaterial.name,
    ...getBlendingParameters(sceneMaterial),
  }
  const isLit = mesh.colors === null && mesh.normals !== null
  const material = isLit
    ? new MeshLambertMaterial({
        ...parameters,
        color: new Color(red / 255, green / 255, blue / 255),
      })
    : new MeshBasicMaterial(parameters)
  // The render trace reads the state the material stands for.
  material.userData['renderState'] = sceneMaterial.renderState
  const alphaTestCode = getAlphaTestCode(sceneMaterial)
  if (alphaTestCode !== null) {
    material.onBeforeCompile = (shader) => {
      // eslint-disable-next-line no-param-reassign -- three.js hands the shader in to be edited
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <alphatest_fragment>',
        alphaTestCode
      )
    }
    material.customProgramCacheKey = () => alphaTestCode
  }
  return material
}

import type {
  BlendFactorValue,
  CompareFunctionValue,
  SceneMaterial,
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
  CustomBlending,
  DataTexture,
  FrontSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
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
import {
  getIsHighDefinitionEnabled,
  getPageSearch,
  loadHighDefinitionPixels,
} from './high-definition-texture/high-definition-texture.ts'

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

// The surface the engine hands Direct3D holds the picture's last row first (GolDP.dll 0x10019da0 writes it with a
// negative pitch), so a model's v = 0 is the picture's bottom edge. The render trace finds every texture the original
// uploads equal to its bitmap with the rows reversed.
export const getRowsReversed = (colors: Uint8Array, width: number, height: number): Uint8Array => {
  const rowBytes = width * 4
  const reversed = new Uint8Array(colors.length)
  for (let row = 0; row < height; row++) {
    reversed.set(
      colors.subarray(row * rowBytes, (row + 1) * rowBytes),
      (height - 1 - row) * rowBytes
    )
  }
  return reversed
}

const getTextureKey = (textureIndex: number, material: SceneMaterial) =>
  `${String(textureIndex)}/${material.renderState.filter}/${material.renderState.addressing}`

// The device samples with the material's filter and addressing (D3DTSS_MAGFILTER/MINFILTER/ADDRESS) and
// no mip-mapping; colours pass through without colour management, as Direct3D 6 does.
const getTexture = (
  textures: readonly SceneTexture[],
  textureIndex: number | null,
  material: SceneMaterial,
  cache: TextureCache,
  isRowOrderKept: boolean
): DataTexture | null => {
  const bitmap = textureIndex === null ? null : (textures[textureIndex]?.bitmap ?? null)
  if (textureIndex === null || bitmap === null) return null
  const key = getTextureKey(textureIndex, material)
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const texture = new DataTexture(
    isRowOrderKept ? bitmap.colors : getRowsReversed(bitmap.colors, bitmap.width, bitmap.height),
    bitmap.width,
    bitmap.height,
    RGBAFormat
  )
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
  texture.name = textures[textureIndex]?.name ?? ''
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  const sceneTexture = textures[textureIndex]
  if (sceneTexture !== undefined && getIsHighDefinitionEnabled(getPageSearch())) {
    void loadHighDefinitionPixels(sceneTexture.bitmapPath, bitmap).then((pixels) => {
      if (pixels === null) return
      // The GPU copy was allocated at the original's size (immutable storage); release it so the larger picture
      // is uploaded into a new one.
      texture.dispose()
      texture.image = {
        data: isRowOrderKept
          ? pixels.colors
          : getRowsReversed(pixels.colors, pixels.width, pixels.height),
        width: pixels.width,
        height: pixels.height,
      }
      if (filter === LinearFilter) {
        texture.minFilter = LinearMipmapLinearFilter
        texture.generateMipmaps = true
      }
      texture.needsUpdate = true
    })
  }
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

// Direct3D's surface has no alpha channel, so a blend leaves it alone; three.js would blend the canvas's alpha with the
// colour's and the page would composite (and read back) the image brighter than it was drawn.
export const KEPT_SURFACE_ALPHA = Object.freeze({
  blendSrcAlpha: ZeroFactor,
  blendDstAlpha: OneFactor,
})

const getBlendingParameters = (sceneMaterial: SceneMaterial): BlendingParameters => {
  const { renderState } = sceneMaterial
  if (!renderState.isBlendEnabled) return { blending: NoBlending, transparent: false }
  return {
    blending: CustomBlending,
    blendSrc: BLEND_FACTORS[renderState.sourceBlend],
    blendDst: BLEND_FACTORS[renderState.destinationBlend] as BlendingDstFactor,
    ...KEPT_SURFACE_ALPHA,
    transparent: true,
  }
}

// The device state of GolDP.dll 0x1000a2c0 for one material. Every model draws unlit with the colour in its vertices: its
// own for a prelit model, the light function's for a model with normals (see batch-geometry.ts).
export const createSceneMaterial = (
  sceneMaterial: SceneMaterial,
  textures: readonly SceneTexture[],
  cache: TextureCache,
  isRowOrderKept = false
): Material => {
  const parameters = {
    map: getTexture(textures, sceneMaterial.textureIndex, sceneMaterial, cache, isRowOrderKept),
    vertexColors: true,
    // 0x1000ebd0 culls in screen space: it draws a face only when its corners turn counter-clockwise on
    // screen, which is three.js's front face for the same world, so only front faces are drawn.
    side: FrontSide,
    name: sceneMaterial.name,
    ...getBlendingParameters(sceneMaterial),
  }
  // Lit models carry their lighting in the vertex colours (see batch-geometry.ts): no three.js lights.
  const material = new MeshBasicMaterial(parameters)
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

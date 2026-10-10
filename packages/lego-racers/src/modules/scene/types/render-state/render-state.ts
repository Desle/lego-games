import {
  BlendFactor,
  CompareFunction,
  ShadeMode,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from '../scene-enums/scene-enums.ts'
import type {
  BlendFactor as BlendFactorValue,
  CompareFunction as CompareFunctionValue,
  SceneRenderState,
} from '../scene.types.ts'
import type { RenderStateInput } from './render-state.types.ts'

const MaterialFlag = Object.freeze({
  GOURAUD: 0x4,
  TEXTURED: 0x8,
  SELECT_TEXTURE: 0x10,
  MODULATE: 0x20,
  ALPHA_TEST: 0x40,
  ALPHA_TEST_OFF: 0x80,
  BLEND: 0x100,
  BLEND_OFF: 0x200,
  POINT_FILTER: 0x800,
  OPACITY: 0x1000,
  CLAMP: 0x10000,
})

// TDB keyword 0x2c sets texture flag 0x20 (a colour key).
const TEXTURE_COLOR_KEY_FLAG = 0x20

// Table 0x10056540 in index order.
const ALPHA_FUNCTIONS: readonly CompareFunctionValue[] = [
  CompareFunction.ALWAYS,
  CompareFunction.EQUAL,
  CompareFunction.GREATER,
  CompareFunction.GREATER_EQUAL,
  CompareFunction.LESS,
  CompareFunction.LESS_EQUAL,
  CompareFunction.NEVER,
  CompareFunction.NOT_EQUAL,
]

// Table 0x1005658c in index order: 1 2 3 9 4 10 5 7 6 8 11 (D3DBLEND).
const BLEND_FACTORS: readonly BlendFactorValue[] = [
  BlendFactor.ZERO,
  BlendFactor.ONE,
  BlendFactor.SOURCE_COLOR,
  BlendFactor.DESTINATION_COLOR,
  BlendFactor.INVERSE_SOURCE_COLOR,
  BlendFactor.INVERSE_DESTINATION_COLOR,
  BlendFactor.SOURCE_ALPHA,
  BlendFactor.DESTINATION_ALPHA,
  BlendFactor.INVERSE_SOURCE_ALPHA,
  BlendFactor.INVERSE_DESTINATION_ALPHA,
  BlendFactor.SOURCE_ALPHA_SATURATE,
]

const getAlphaFunction = (index: number): CompareFunctionValue =>
  ALPHA_FUNCTIONS[index] ?? CompareFunction.ALWAYS

const getBlendFactor = (index: number): BlendFactorValue => BLEND_FACTORS[index] ?? BlendFactor.ONE

// GolDP.dll 0x100257e0 on a device with flag 0x100 (alpha compare, no hardware colour key): a colour-keyed
// texture switches alpha testing on with function 2 (GREATER) and reference 0.
const getColorKeyedInput = (input: RenderStateInput): RenderStateInput =>
  (input.flags & MaterialFlag.TEXTURED) !== 0 &&
  input.textureFlags !== null &&
  (input.textureFlags & TEXTURE_COLOR_KEY_FLAG) !== 0
    ? Object.freeze({
        ...input,
        flags: (input.flags & ~MaterialFlag.ALPHA_TEST_OFF) | MaterialFlag.ALPHA_TEST,
        alphaFunction: 2,
        alphaReference: 0,
      })
    : input

// GolDP.dll 0x1000a2c0: the Direct3D render and texture-stage states one material sets.
export const getRenderState = (material: RenderStateInput): SceneRenderState => {
  const input = getColorKeyedInput(material)
  const isOpacity = (input.flags & MaterialFlag.OPACITY) !== 0
  // With opacity the colour operation is forced to modulate (flags & ~0x10 | 0x20).
  const flags = isOpacity
    ? (input.flags & ~MaterialFlag.SELECT_TEXTURE) | MaterialFlag.MODULATE
    : input.flags
  const isTextured = (flags & MaterialFlag.TEXTURED) !== 0
  const isModulated = (flags & MaterialFlag.MODULATE) !== 0
  const isBlend = (flags & MaterialFlag.BLEND) !== 0
  const getTexturedOperation = (isModulatedOperation: boolean) =>
    isModulatedOperation ? TextureOperation.MODULATE : TextureOperation.SELECT_TEXTURE
  return Object.freeze({
    shading: (flags & MaterialFlag.GOURAUD) === 0 ? ShadeMode.FLAT : ShadeMode.GOURAUD,
    colorOperation: isTextured
      ? getTexturedOperation(isModulated)
      : TextureOperation.SELECT_DIFFUSE,
    alphaOperation: isTextured
      ? getTexturedOperation((flags & (MaterialFlag.OPACITY | MaterialFlag.MODULATE)) !== 0)
      : TextureOperation.SELECT_DIFFUSE,
    diffuseAlpha: isOpacity ? input.destinationBlendOrOpacity : null,
    isDiffuseWhite: isTextured && !isModulated,
    isAlphaTestEnabled: (flags & MaterialFlag.ALPHA_TEST) !== 0,
    alphaFunction: getAlphaFunction(input.alphaFunction),
    alphaReference: input.alphaReference,
    isBlendEnabled: isOpacity || isBlend,
    sourceBlend: isOpacity
      ? BlendFactor.SOURCE_ALPHA
      : isBlend
        ? getBlendFactor(input.sourceBlend)
        : BlendFactor.ONE,
    destinationBlend: isOpacity
      ? BlendFactor.INVERSE_SOURCE_ALPHA
      : isBlend
        ? getBlendFactor(input.destinationBlendOrOpacity)
        : BlendFactor.ZERO,
    filter: (flags & MaterialFlag.POINT_FILTER) === 0 ? TextureFilter.LINEAR : TextureFilter.POINT,
    addressing:
      (flags & MaterialFlag.CLAMP) === 0 ? TextureAddressing.WRAP : TextureAddressing.CLAMP,
  })
}

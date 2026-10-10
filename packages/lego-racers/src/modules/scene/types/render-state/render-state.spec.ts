import {
  BlendFactor,
  CompareFunction,
  ShadeMode,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from '../scene-enums/scene-enums.ts'
import { getRenderState } from './render-state.ts'

// The flags every MDB material starts from (GolDP.dll 0x10026270).
const DEFAULT_FLAGS = 0x0050a694
const TEXTURED_FLAGS = DEFAULT_FLAGS | 0x8

const createInput = (flags: number, textureFlags: number | null = null) => ({
  flags,
  alphaFunction: 2,
  alphaReference: 0,
  sourceBlend: 1,
  destinationBlendOrOpacity: 0,
  textureFlags,
})

describe('getRenderState', () => {
  it('draws an untextured default material opaque, Gouraud-shaded, from the diffuse colour', () => {
    // Arrange
    const input = createInput(DEFAULT_FLAGS)

    // Act
    const state = getRenderState(input)

    // Assert
    expect(state).toEqual({
      shading: ShadeMode.GOURAUD,
      colorOperation: TextureOperation.SELECT_DIFFUSE,
      alphaOperation: TextureOperation.SELECT_DIFFUSE,
      diffuseAlpha: null,
      isDiffuseWhite: false,
      isAlphaTestEnabled: false,
      alphaFunction: CompareFunction.GREATER,
      alphaReference: 0,
      isBlendEnabled: false,
      sourceBlend: BlendFactor.ONE,
      destinationBlend: BlendFactor.ZERO,
      filter: TextureFilter.LINEAR,
      addressing: TextureAddressing.WRAP,
    })
  })

  it('selects the texture alone for a textured default material, with a white diffuse colour', () => {
    // Arrange
    const input = createInput(TEXTURED_FLAGS, 0x80c)

    // Act
    const state = getRenderState(input)

    // Assert
    expect(state.colorOperation).toBe(TextureOperation.SELECT_TEXTURE)
    expect(state.alphaOperation).toBe(TextureOperation.SELECT_TEXTURE)
    expect(state.isDiffuseWhite).toBe(true)
  })

  it('modulates colour and alpha when keyword 0x2d set flag 0x20', () => {
    // Arrange
    const input = createInput((TEXTURED_FLAGS & ~0x10) | 0x20, 0x80c)

    // Act
    const state = getRenderState(input)

    // Assert
    expect(state.colorOperation).toBe(TextureOperation.MODULATE)
    expect(state.alphaOperation).toBe(TextureOperation.MODULATE)
    expect(state.isDiffuseWhite).toBe(false)
  })

  it('maps the blend indices through table 0x1005658c', () => {
    // Arrange
    const input = { ...createInput((DEFAULT_FLAGS & ~0x1200) | 0x2100), sourceBlend: 6 }

    // Act
    const additive = getRenderState({ ...input, destinationBlendOrOpacity: 1 })
    const translucent = getRenderState({ ...input, destinationBlendOrOpacity: 8 })

    // Assert
    expect(additive).toMatchObject({
      isBlendEnabled: true,
      sourceBlend: BlendFactor.SOURCE_ALPHA,
      destinationBlend: BlendFactor.ONE,
    })
    expect(translucent.destinationBlend).toBe(BlendFactor.INVERSE_SOURCE_ALPHA)
  })

  it('blends a constant opacity as source alpha and forces modulation', () => {
    // Arrange
    const input = {
      ...createInput((TEXTURED_FLAGS & ~0x2100) | 0x1200, 0x80c),
      destinationBlendOrOpacity: 128,
    }

    // Act
    const state = getRenderState(input)

    // Assert
    expect(state).toMatchObject({
      colorOperation: TextureOperation.MODULATE,
      alphaOperation: TextureOperation.MODULATE,
      diffuseAlpha: 128,
      isBlendEnabled: true,
      sourceBlend: BlendFactor.SOURCE_ALPHA,
      destinationBlend: BlendFactor.INVERSE_SOURCE_ALPHA,
    })
  })

  it('alpha-tests a colour-keyed texture with GREATER 0 (0x100257e0)', () => {
    // Arrange
    const input = { ...createInput(TEXTURED_FLAGS, 0x82c), alphaFunction: 0, alphaReference: 9 }

    // Act
    const state = getRenderState(input)

    // Assert
    expect(state).toMatchObject({
      isAlphaTestEnabled: true,
      alphaFunction: CompareFunction.GREATER,
      alphaReference: 0,
    })
  })

  it('reads flat shading, point filtering and clamping from their flags', () => {
    // Arrange
    const input = createInput((DEFAULT_FLAGS & ~0x4 & ~0x400 & ~0x8000) | 0x2 | 0x800 | 0x10000)

    // Act
    const state = getRenderState(input)

    // Assert
    expect(state.shading).toBe(ShadeMode.FLAT)
    expect(state.filter).toBe(TextureFilter.POINT)
    expect(state.addressing).toBe(TextureAddressing.CLAMP)
  })
})

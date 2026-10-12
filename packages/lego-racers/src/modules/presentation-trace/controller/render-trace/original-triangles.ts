import {
  BlendFactor,
  CompareFunction,
  ShadeMode,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from '../../../scene/index.ts'
import type {
  BlendFactorValue,
  CompareFunctionValue,
  TextureOperationValue,
} from '../../../scene/index.ts'
import type {
  OriginalDraw,
  OriginalRenderFrame,
  OriginalRenderState,
  OriginalVertex,
} from '../../types/presentation-trace.types.ts'
import type { DrawState, DrawnTriangle, ScreenVertex } from './render-trace.types.ts'

const RenderStateNumber = Object.freeze({
  Z_ENABLE: '7',
  SHADE_MODE: '9',
  Z_WRITE_ENABLE: '14',
  ALPHA_TEST_ENABLE: '15',
  SOURCE_BLEND: '19',
  DESTINATION_BLEND: '20',
  ALPHA_REFERENCE: '24',
  ALPHA_FUNCTION: '25',
  ALPHA_BLEND_ENABLE: '27',
  COLOR_KEY_ENABLE: '41',
})

const StageStateNumber = Object.freeze({
  COLOR_OPERATION: '0.1',
  ADDRESS: '0.12',
  MAGNIFICATION_FILTER: '0.16',
})

// D3DBLEND by value.
const BLEND_FACTORS: Readonly<Record<number, BlendFactorValue>> = Object.freeze({
  1: BlendFactor.ZERO,
  2: BlendFactor.ONE,
  3: BlendFactor.SOURCE_COLOR,
  4: BlendFactor.INVERSE_SOURCE_COLOR,
  5: BlendFactor.SOURCE_ALPHA,
  6: BlendFactor.INVERSE_SOURCE_ALPHA,
  7: BlendFactor.DESTINATION_ALPHA,
  8: BlendFactor.INVERSE_DESTINATION_ALPHA,
  9: BlendFactor.DESTINATION_COLOR,
  10: BlendFactor.INVERSE_DESTINATION_COLOR,
  11: BlendFactor.SOURCE_ALPHA_SATURATE,
})

// D3DCMPFUNC by value.
const COMPARE_FUNCTIONS: Readonly<Record<number, CompareFunctionValue>> = Object.freeze({
  1: CompareFunction.NEVER,
  2: CompareFunction.LESS,
  3: CompareFunction.EQUAL,
  4: CompareFunction.LESS_EQUAL,
  5: CompareFunction.GREATER,
  6: CompareFunction.NOT_EQUAL,
  7: CompareFunction.GREATER_EQUAL,
  8: CompareFunction.ALWAYS,
})

// D3DTOP by value (the three operations GolDP.dll 0x1000a2c0 uses).
const TEXTURE_OPERATIONS: Readonly<Record<number, TextureOperationValue>> = Object.freeze({
  2: TextureOperation.SELECT_TEXTURE,
  3: TextureOperation.SELECT_DIFFUSE,
  4: TextureOperation.MODULATE,
})

const DIRECT3D_WRAP = 1
const DIRECT3D_POINT_FILTER = 1
const DIRECT3D_GOURAUD = 2

// The original's Direct3D state in the port's terms.
export const getDrawState = (state: OriginalRenderState): DrawState => {
  const render = (name: string): number => state.render[name] ?? 0
  const stage = (name: string): number => state.stage[name] ?? 0
  return Object.freeze({
    shading:
      render(RenderStateNumber.SHADE_MODE) === DIRECT3D_GOURAUD
        ? ShadeMode.GOURAUD
        : ShadeMode.FLAT,
    colorOperation:
      TEXTURE_OPERATIONS[stage(StageStateNumber.COLOR_OPERATION)] ??
      TextureOperation.SELECT_DIFFUSE,
    isAlphaTestEnabled: render(RenderStateNumber.ALPHA_TEST_ENABLE) !== 0,
    alphaFunction:
      COMPARE_FUNCTIONS[render(RenderStateNumber.ALPHA_FUNCTION)] ?? CompareFunction.ALWAYS,
    alphaReference: render(RenderStateNumber.ALPHA_REFERENCE),
    isBlendEnabled: render(RenderStateNumber.ALPHA_BLEND_ENABLE) !== 0,
    sourceBlend: BLEND_FACTORS[render(RenderStateNumber.SOURCE_BLEND)] ?? BlendFactor.ONE,
    destinationBlend:
      BLEND_FACTORS[render(RenderStateNumber.DESTINATION_BLEND)] ?? BlendFactor.ZERO,
    filter:
      stage(StageStateNumber.MAGNIFICATION_FILTER) === DIRECT3D_POINT_FILTER
        ? TextureFilter.POINT
        : TextureFilter.LINEAR,
    addressing:
      stage(StageStateNumber.ADDRESS) === DIRECT3D_WRAP
        ? TextureAddressing.WRAP
        : TextureAddressing.CLAMP,
    isDepthTestEnabled: render(RenderStateNumber.Z_ENABLE) !== 0,
    isDepthWriteEnabled: render(RenderStateNumber.Z_WRITE_ENABLE) !== 0,
    isColorKeyEnabled: render(RenderStateNumber.COLOR_KEY_ENABLE) !== 0,
  })
}

const BYTE_MASK = 0xff

// D3DCOLOR is ARGB.
const getDiffuse = (packed: number): ScreenVertex['diffuse'] => [
  (packed >>> 16) & BYTE_MASK,
  (packed >>> 8) & BYTE_MASK,
  packed & BYTE_MASK,
  (packed >>> 24) & BYTE_MASK,
]

const getScreenVertex = (vertex: OriginalVertex): ScreenVertex =>
  Object.freeze({
    x: vertex.x,
    y: vertex.y,
    reciprocalW: vertex.reciprocalW,
    u: vertex.u,
    v: vertex.v,
    diffuse: getDiffuse(vertex.diffuse),
  })

const TRIANGLE_LIST = 4

const getDrawTriangles = (draw: OriginalDraw, state: DrawState): readonly DrawnTriangle[] => {
  if (draw.primitive !== TRIANGLE_LIST) return []
  const order = draw.indices ?? draw.vertices.map((_vertex, index) => index)
  const triangles: DrawnTriangle[] = []
  for (let start = 0; start + 2 < order.length; start += 3) {
    const corners = [order[start], order[start + 1], order[start + 2]].map(
      (index) => draw.vertices[index ?? 0]
    )
    const [first, second, third] = corners
    if (first === undefined || second === undefined || third === undefined) continue
    triangles.push(
      Object.freeze({
        vertices: [
          getScreenVertex(first),
          getScreenVertex(second),
          getScreenVertex(third),
        ] as const,
        textureKey: draw.textureHash,
        state,
        source: draw.textureHash ?? 'untextured',
      })
    )
  }
  return triangles
}

// Every triangle the original handed to Direct3D in a frame, in draw order, with the state it was drawn under.
export const getOriginalTriangles = (frame: OriginalRenderFrame): readonly DrawnTriangle[] => {
  const states = frame.states.map(getDrawState)
  return frame.draws.flatMap((draw) =>
    getDrawTriangles(draw, states[draw.stateIndex] ?? getDrawState({ render: {}, stage: {} }))
  )
}

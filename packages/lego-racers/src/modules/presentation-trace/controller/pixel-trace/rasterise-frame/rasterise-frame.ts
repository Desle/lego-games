/* eslint-disable no-param-reassign -- the rasteriser writes into preallocated buffers; allocating per pixel is far too slow */
import {
  BlendFactor,
  CompareFunction,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from '../../../../scene/index.ts'
import type { BlendFactorValue, CompareFunctionValue } from '../../../../scene/index.ts'
import type {
  OriginalDraw,
  OriginalRenderFrame,
  OriginalTexture,
  OriginalVertex,
} from '../../../types/presentation-trace.types.ts'
import { getDrawState } from '../../render-trace/original-triangles.ts'
import type { DrawState } from '../../render-trace/render-trace.types.ts'
import { decodeTexture } from '../decode-texture.ts'
import type { DecodedTexture, RasterisedFrame, RasteriseOptions } from '../pixel-trace.types.ts'
import type { Corner, DrawContext, Scratch, Target } from './rasterise-frame.types.ts'

const VERTICES_PER_TRIANGLE = 3 // @check-allow traced-constants: a triangle has three corners
const RGB_CHANNEL_COUNT = 3 // @check-allow traced-constants: red, green and blue
const CHANNEL_COUNT = 4 // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
const CHANNEL_MAXIMUM = 255 // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
const BYTE_MASK = 0xff
const TRIANGLE_LIST = 4 // @check-allow traced-constants: Direct3D D3DPT value of the recorded draw (DrawIndexedPrimitive primitive type, render-trace.md)
const TRIANGLE_STRIP = 5 // @check-allow traced-constants: Direct3D D3DPT value of the recorded draw (DrawIndexedPrimitive primitive type, render-trace.md)
const TRIANGLE_FAN = 6 // @check-allow traced-constants: Direct3D D3DPT value of the recorded draw (DrawIndexedPrimitive primitive type, render-trace.md)
const NO_TEXTURE = -1

// Direct3D hands the draw a diffuse colour as ARGB.
const getCorner = (vertex: OriginalVertex): Corner =>
  Object.freeze({
    x: vertex.x,
    y: vertex.y,
    depth: vertex.depth,
    reciprocalW: vertex.reciprocalW,
    u: vertex.u,
    v: vertex.v,
    red: (vertex.diffuse >>> 16) & BYTE_MASK,
    green: (vertex.diffuse >>> 8) & BYTE_MASK,
    blue: vertex.diffuse & BYTE_MASK,
    alpha: (vertex.diffuse >>> 24) & BYTE_MASK,
  })

const getTriangleIndices = (draw: OriginalDraw): readonly (readonly [number, number, number])[] => {
  const order = draw.indices ?? draw.vertices.map((_vertex, index) => index)
  if (draw.primitive === TRIANGLE_LIST) {
    return Array.from(
      { length: Math.floor(order.length / VERTICES_PER_TRIANGLE) },
      (_, triangle) => [
        order[triangle * 3] ?? 0, // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
        order[triangle * 3 + 1] ?? 0, // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
        order[triangle * 3 + 2] ?? 0, // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
      ]
    )
  }
  if (draw.primitive === TRIANGLE_STRIP) {
    return Array.from({ length: Math.max(0, order.length - 2) }, (_, triangle) =>
      triangle % 2 === 0
        ? [order[triangle] ?? 0, order[triangle + 1] ?? 0, order[triangle + 2] ?? 0]
        : [order[triangle + 1] ?? 0, order[triangle] ?? 0, order[triangle + 2] ?? 0]
    )
  }
  if (draw.primitive === TRIANGLE_FAN) {
    return Array.from({ length: Math.max(0, order.length - 2) }, (_, triangle) => [
      order[0] ?? 0,
      order[triangle + 1] ?? 0,
      order[triangle + 2] ?? 0,
    ])
  }
  return []
}

const getEdge = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  pointX: number,
  pointY: number
): number => (toX - fromX) * (pointY - fromY) - (toY - fromY) * (pointX - fromX)

// The top-left rule of a clockwise triangle on a screen with y down: an edge going up, or going right along the top.
const getIsTopLeftEdge = (fromX: number, fromY: number, toX: number, toY: number): boolean =>
  toY < fromY || (toY === fromY && toX > fromX)

const getWrapped = (index: number, size: number): number => ((index % size) + size) % size

const getTexelIndex = (index: number, size: number, addressing: string): number =>
  addressing === TextureAddressing.WRAP
    ? getWrapped(index, size)
    : Math.min(Math.max(index, 0), size - 1)

const getComparison = (
  compareFunction: CompareFunctionValue,
  value: number,
  reference: number
): boolean => {
  switch (compareFunction) {
    case CompareFunction.NEVER:
      return false
    case CompareFunction.LESS:
      return value < reference
    case CompareFunction.EQUAL:
      return value === reference
    case CompareFunction.LESS_EQUAL:
      return value <= reference
    case CompareFunction.GREATER:
      return value > reference
    case CompareFunction.NOT_EQUAL:
      return value !== reference
    case CompareFunction.GREATER_EQUAL:
      return value >= reference
    default:
      return true
  }
}

// One channel of a blend factor (0..1) from the source and destination colours (red, green, blue, alpha in 0..1).
const getBlendFactor = (
  factor: BlendFactorValue,
  source: Float64Array,
  destination: Float64Array,
  channel: number
): number => {
  const sourceAlpha = source[3] ?? 1
  const destinationAlpha = destination[3] ?? 1
  switch (factor) {
    case BlendFactor.ZERO:
      return 0
    case BlendFactor.ONE:
      return 1
    case BlendFactor.SOURCE_COLOR:
      return source[channel] ?? 0
    case BlendFactor.INVERSE_SOURCE_COLOR:
      return 1 - (source[channel] ?? 0)
    case BlendFactor.DESTINATION_COLOR:
      return destination[channel] ?? 0
    case BlendFactor.INVERSE_DESTINATION_COLOR:
      return 1 - (destination[channel] ?? 0)
    case BlendFactor.SOURCE_ALPHA:
      return sourceAlpha
    case BlendFactor.INVERSE_SOURCE_ALPHA:
      return 1 - sourceAlpha
    case BlendFactor.DESTINATION_ALPHA:
      return destinationAlpha
    case BlendFactor.INVERSE_DESTINATION_ALPHA:
      return 1 - destinationAlpha
    default:
      return Math.min(sourceAlpha, 1 - destinationAlpha)
  }
}

const getTexel = (
  texture: DecodedTexture,
  x: number,
  y: number,
  addressing: string,
  channel: number
): number => {
  const column = getTexelIndex(x, texture.width, addressing)
  const row = getTexelIndex(y, texture.height, addressing)
  return texture.colors[(row * texture.width + column) * CHANNEL_COUNT + channel] ?? 0
}

// Samples a texture at (u, v) in texture units into `output` (red, green, blue, alpha, 0..255).
const sampleTexture = (
  texture: DecodedTexture,
  state: DrawState,
  u: number,
  v: number,
  output: Float64Array
) => {
  const scaledU = u * texture.width
  const scaledV = v * texture.height
  for (let channel = 0; channel < CHANNEL_COUNT; channel++) {
    if (state.filter === TextureFilter.POINT) {
      output[channel] = getTexel(
        texture,
        Math.floor(scaledU),
        Math.floor(scaledV),
        state.addressing,
        channel
      )
      continue
    }
    const left = Math.floor(scaledU - 0.5) // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
    const top = Math.floor(scaledV - 0.5) // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
    const fractionX = scaledU - 0.5 - left // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
    const fractionY = scaledV - 0.5 - top // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
    const upper =
      getTexel(texture, left, top, state.addressing, channel) * (1 - fractionX) +
      getTexel(texture, left + 1, top, state.addressing, channel) * fractionX
    const lower =
      getTexel(texture, left, top + 1, state.addressing, channel) * (1 - fractionX) +
      getTexel(texture, left + 1, top + 1, state.addressing, channel) * fractionX
    output[channel] = upper * (1 - fractionY) + lower * fractionY
  }
}

// Whether the texel nearest to (u, v) is the surface's colour key (the original's hardware does not draw it).
const getIsKeyedTexel = (
  texture: DecodedTexture,
  state: DrawState,
  u: number,
  v: number
): boolean => {
  if (!state.isColorKeyEnabled || texture.keyedTexels === null) return false
  const column = getTexelIndex(Math.floor(u * texture.width), texture.width, state.addressing)
  const row = getTexelIndex(Math.floor(v * texture.height), texture.height, state.addressing)
  return texture.keyedTexels[row * texture.width + column] === 1
}

// The colour of one fragment into `scratch.source` (0..1): the texture operation, then nothing else. False when the
// fragment is a colour-keyed texel, which is not drawn.
const shadeFragment = (
  context: DrawContext,
  scratch: Scratch,
  weights: readonly [number, number, number],
  corners: readonly [Corner, Corner, Corner]
): boolean => {
  const [first, second, third] = corners
  const [weightFirst, weightSecond, weightThird] = weights
  scratch.diffuse[0] = weightFirst * first.red + weightSecond * second.red + weightThird * third.red
  scratch.diffuse[1] =
    weightFirst * first.green + weightSecond * second.green + weightThird * third.green
  scratch.diffuse[2] =
    weightFirst * first.blue + weightSecond * second.blue + weightThird * third.blue
  scratch.diffuse[3] =
    weightFirst * first.alpha + weightSecond * second.alpha + weightThird * third.alpha
  const perspectiveFirst = weightFirst * first.reciprocalW
  const perspectiveSecond = weightSecond * second.reciprocalW
  const perspectiveThird = weightThird * third.reciprocalW
  const perspectiveTotal = perspectiveFirst + perspectiveSecond + perspectiveThird
  const operation = context.state.colorOperation
  const { texture } = context
  if (texture === null || operation === TextureOperation.SELECT_DIFFUSE || perspectiveTotal <= 0) {
    for (let channel = 0; channel < CHANNEL_COUNT; channel++) {
      scratch.source[channel] = (scratch.diffuse[channel] ?? 0) / CHANNEL_MAXIMUM
    }
    return true
  }
  const u =
    (perspectiveFirst * first.u + perspectiveSecond * second.u + perspectiveThird * third.u) /
    perspectiveTotal
  const v =
    (perspectiveFirst * first.v + perspectiveSecond * second.v + perspectiveThird * third.v) /
    perspectiveTotal
  if (getIsKeyedTexel(texture, context.state, u, v)) return false
  sampleTexture(texture, context.state, u, v, scratch.texel)
  for (let channel = 0; channel < CHANNEL_COUNT; channel++) {
    const texel = (scratch.texel[channel] ?? 0) / CHANNEL_MAXIMUM
    scratch.source[channel] =
      operation === TextureOperation.MODULATE
        ? (texel * (scratch.diffuse[channel] ?? 0)) / CHANNEL_MAXIMUM
        : texel
  }
  return true
}

// Alpha test, then blend into the colour buffer; returns whether the fragment wrote its colour.
const writeFragment = (target: Target, offset: number, context: DrawContext, scratch: Scratch) => {
  const { state } = context
  const alpha = (scratch.source[3] ?? 1) * CHANNEL_MAXIMUM
  if (
    state.isAlphaTestEnabled &&
    !getComparison(state.alphaFunction, Math.round(alpha), state.alphaReference)
  ) {
    return false
  }
  for (let channel = 0; channel < RGB_CHANNEL_COUNT; channel++) {
    const stored = (target.colors[offset * CHANNEL_COUNT + channel] ?? 0) / CHANNEL_MAXIMUM
    scratch.destination[channel] = stored
  }
  scratch.destination[RGB_CHANNEL_COUNT] = 1
  for (let channel = 0; channel < RGB_CHANNEL_COUNT; channel++) {
    const source = scratch.source[channel] ?? 0
    const color = state.isBlendEnabled
      ? source * getBlendFactor(state.sourceBlend, scratch.source, scratch.destination, channel) +
        (scratch.destination[channel] ?? 0) *
          getBlendFactor(state.destinationBlend, scratch.source, scratch.destination, channel)
      : source
    target.colors[offset * CHANNEL_COUNT + channel] = Math.round(color * CHANNEL_MAXIMUM)
  }
  return true
}

const rasteriseTriangle = (
  target: Target,
  context: DrawContext,
  scratch: Scratch,
  triangle: readonly [Corner, Corner, Corner]
) => {
  const [first, originalSecond, originalThird] = triangle
  const area = getEdge(
    first.x,
    first.y,
    originalSecond.x,
    originalSecond.y,
    originalThird.x,
    originalThird.y
  )
  if (area === 0 || !Number.isFinite(area)) return
  // Wind clockwise (positive area) so the inside test and the top-left rule hold for either winding.
  const second = area > 0 ? originalSecond : originalThird
  const third = area > 0 ? originalThird : originalSecond
  const corners = [first, second, third] as const
  const totalArea = Math.abs(area)
  const isFirstEdgeOwned = getIsTopLeftEdge(second.x, second.y, third.x, third.y)
  const isSecondEdgeOwned = getIsTopLeftEdge(third.x, third.y, first.x, first.y)
  const isThirdEdgeOwned = getIsTopLeftEdge(first.x, first.y, second.x, second.y)
  const left = Math.max(0, Math.floor(Math.min(first.x, second.x, third.x)))
  const right = Math.min(target.width - 1, Math.ceil(Math.max(first.x, second.x, third.x)))
  const top = Math.max(0, Math.floor(Math.min(first.y, second.y, third.y)))
  const bottom = Math.min(target.height - 1, Math.ceil(Math.max(first.y, second.y, third.y)))
  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) {
      const pointX = column + 0.5 // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
      const pointY = row + 0.5 // @check-allow traced-constants: software rasteriser geometry (pixel centre, triangle vertices, channels); hypothesis of the original hardware, not traced
      const edgeFirst = getEdge(second.x, second.y, third.x, third.y, pointX, pointY)
      const edgeSecond = getEdge(third.x, third.y, first.x, first.y, pointX, pointY)
      const edgeThird = getEdge(first.x, first.y, second.x, second.y, pointX, pointY)
      if (
        edgeFirst < 0 ||
        edgeSecond < 0 ||
        edgeThird < 0 ||
        (edgeFirst === 0 && !isFirstEdgeOwned) ||
        (edgeSecond === 0 && !isSecondEdgeOwned) ||
        (edgeThird === 0 && !isThirdEdgeOwned)
      ) {
        continue
      }
      const weights = [
        edgeFirst / totalArea,
        edgeSecond / totalArea,
        edgeThird / totalArea,
      ] as const
      const depth = weights[0] * first.depth + weights[1] * second.depth + weights[2] * third.depth
      const offset = row * target.width + column
      if (context.state.isDepthTestEnabled && (depth < 0 || depth > (target.depths[offset] ?? 1))) {
        continue
      }
      if (!shadeFragment(context, scratch, weights, corners)) continue
      if (!writeFragment(target, offset, context, scratch)) continue
      if (context.state.isDepthWriteEnabled) target.depths[offset] = depth
      target.textureIndices[offset] = context.textureIndex
    }
  }
}

const getLastDepthTestedDraw = (frame: OriginalRenderFrame, states: readonly DrawState[]): number =>
  frame.draws.reduce(
    (last, draw, index) => (states[draw.stateIndex]?.isDepthTestEnabled === true ? index : last),
    -1
  )

// Draws what the original handed Direct3D in a frame into 640 x 480 RGBA, with the recorded states: the depth test
// (less or equal) and write, the texture operation, the colour and alpha of the texture and vertices (UVs perspective
// correct, colours linear in screen space), the alpha test and the blend factors. Pixel centres are at +0.5.
export const rasteriseFrame = (
  frame: OriginalRenderFrame,
  textures: ReadonlyMap<string, OriginalTexture>,
  options: RasteriseOptions
): RasterisedFrame => {
  const { width, height } = options
  const colors = new Uint8ClampedArray(width * height * CHANNEL_COUNT)
  for (let pixel = 0; pixel < width * height; pixel++) {
    colors.set([...options.clearColor, CHANNEL_MAXIMUM], pixel * CHANNEL_COUNT)
  }
  const target: Target = {
    width,
    height,
    colors,
    depths: new Float32Array(width * height).fill(1),
    textureIndices: new Int16Array(width * height).fill(NO_TEXTURE),
  }
  const scratch: Scratch = {
    diffuse: new Float64Array(CHANNEL_COUNT),
    texel: new Float64Array(CHANNEL_COUNT),
    source: new Float64Array(CHANNEL_COUNT),
    destination: new Float64Array(CHANNEL_COUNT),
  }
  const states = frame.states.map(getDrawState)
  const lastDepthTestedDraw = getLastDepthTestedDraw(frame, states)
  const textureHashes = [
    ...new Set(
      frame.draws.flatMap((draw) => (draw.textureHash === null ? [] : [draw.textureHash]))
    ),
  ]
  const decoded = new Map<string, DecodedTexture>()
  frame.draws.forEach((draw, drawIndex) => {
    const state = states[draw.stateIndex]
    if (state === undefined) return
    if (!options.isHudIncluded && drawIndex > lastDepthTestedDraw) return
    const original = draw.textureHash === null ? undefined : textures.get(draw.textureHash)
    if (draw.textureHash !== null && original !== undefined && !decoded.has(draw.textureHash)) {
      decoded.set(draw.textureHash, decodeTexture(original))
    }
    const context: DrawContext = {
      state,
      texture: draw.textureHash === null ? null : (decoded.get(draw.textureHash) ?? null),
      textureIndex:
        draw.textureHash === null ? NO_TEXTURE : textureHashes.indexOf(draw.textureHash),
    }
    const corners = draw.vertices.map(getCorner)
    for (const [first, second, third] of getTriangleIndices(draw)) {
      const a = corners[first]
      const b = corners[second]
      const c = corners[third]
      if (a !== undefined && b !== undefined && c !== undefined) {
        rasteriseTriangle(target, context, scratch, [a, b, c])
      }
    }
  })
  return Object.freeze({
    width,
    height,
    colors,
    textureIndices: target.textureIndices,
    textureHashes,
  })
}

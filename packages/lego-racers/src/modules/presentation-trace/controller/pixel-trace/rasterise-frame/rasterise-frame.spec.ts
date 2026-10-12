import type {
  OriginalDraw,
  OriginalRenderFrame,
  OriginalRenderState,
  OriginalVertex,
} from '../../../types/presentation-trace.types.ts'
import { rasteriseFrame } from './rasterise-frame.ts'

const OPTIONS = Object.freeze({
  width: 8,
  height: 8,
  isHudIncluded: false,
  clearColor: [0, 0, 0] as const,
})
const NO_TEXTURES = new Map()
const RED = 0xffff0000
const GREEN = 0xff00ff00
const TRIANGLE_LIST = 4

const getVertex = (x: number, y: number, depth: number, diffuse: number): OriginalVertex => ({
  x,
  y,
  depth,
  reciprocalW: 1,
  diffuse,
  specular: 0,
  u: 0,
  v: 0,
})

const getState = (isDepthTested: boolean): OriginalRenderState => ({
  // Z enable (7), Z write enable (14), shade mode Gouraud (9); texture stage 0 selects the diffuse colour (3).
  render: { '7': isDepthTested ? 1 : 0, '9': 2, '14': isDepthTested ? 1 : 0 },
  stage: { '0.1': 3 },
})

const getDraw = (stateIndex: number, depth: number, diffuse: number): OriginalDraw => ({
  primitive: TRIANGLE_LIST,
  fvf: 0x1c4,
  stateIndex,
  textureHash: null,
  vertices: [
    getVertex(0, 0, depth, diffuse),
    getVertex(8, 0, depth, diffuse),
    getVertex(0, 8, depth, diffuse),
  ],
  indices: null,
  clipMatrix: [],
  modelMatrix: [],
})

const getFrame = (draws: readonly OriginalDraw[]): OriginalRenderFrame => ({
  frame: 0,
  viewport: null,
  states: [getState(true), getState(false)],
  draws,
})

describe('rasteriseFrame', () => {
  it('fills the pixels a triangle covers with its diffuse colour and leaves the rest cleared', () => {
    // Arrange
    const frame = getFrame([getDraw(0, 0.5, RED)])

    // Act
    const image = rasteriseFrame(frame, NO_TEXTURES, OPTIONS)

    // Assert
    const insideOffset = (1 * OPTIONS.width + 1) * 4
    const outsideOffset = (6 * OPTIONS.width + 6) * 4
    expect([...image.colors.subarray(insideOffset, insideOffset + 3)]).toEqual([255, 0, 0])
    expect([...image.colors.subarray(outsideOffset, outsideOffset + 3)]).toEqual([0, 0, 0])
  })

  it('keeps the nearer triangle where the depth test applies', () => {
    // Arrange
    const frame = getFrame([getDraw(0, 0.2, GREEN), getDraw(0, 0.8, RED)])

    // Act
    const image = rasteriseFrame(frame, NO_TEXTURES, OPTIONS)

    // Assert
    const offset = (1 * OPTIONS.width + 1) * 4
    expect([...image.colors.subarray(offset, offset + 3)]).toEqual([0, 255, 0])
  })

  it('leaves out the draws after the last depth-tested one unless the HUD is included', () => {
    // Arrange
    const frame = getFrame([getDraw(0, 0.5, GREEN), getDraw(1, 0, RED)])

    // Act
    const without = rasteriseFrame(frame, NO_TEXTURES, OPTIONS)
    const included = rasteriseFrame(frame, NO_TEXTURES, { ...OPTIONS, isHudIncluded: true })

    // Assert
    const offset = (1 * OPTIONS.width + 1) * 4
    expect([...without.colors.subarray(offset, offset + 3)]).toEqual([0, 255, 0])
    expect([...included.colors.subarray(offset, offset + 3)]).toEqual([255, 0, 0])
  })
})

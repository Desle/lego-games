import type { DrawState } from '../../render-trace/render-trace.types.ts'
import type { DecodedTexture } from '../pixel-trace.types.ts'

// A vertex ready to rasterise: screen position, depth, 1/w, texture coordinates and the diffuse colour (0..255).
export type Corner = {
  readonly x: number
  readonly y: number
  readonly depth: number
  readonly reciprocalW: number
  readonly u: number
  readonly v: number
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly alpha: number
}

export type Target = {
  readonly width: number
  readonly height: number
  readonly colors: Uint8ClampedArray
  readonly depths: Float32Array
  readonly textureIndices: Int16Array
}

export type DrawContext = {
  readonly state: DrawState
  readonly texture: DecodedTexture | null
  readonly textureIndex: number
}

export type Scratch = {
  readonly diffuse: Float64Array
  readonly texel: Float64Array
  readonly source: Float64Array
  readonly destination: Float64Array
}

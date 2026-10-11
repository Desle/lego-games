import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { SceneRenderState } from '../../../scene/index.ts'
import type { RenderMismatchKind as RenderMismatchKindValues } from '../../types/render-mismatch-kind/render-mismatch-kind.ts'

// A vertex in screen space: pixels, 1/w, the texture coordinates and the diffuse colour (red, green, blue, alpha, 0..255).
export type ScreenVertex = {
  readonly x: number
  readonly y: number
  readonly reciprocalW: number
  readonly u: number
  readonly v: number
  readonly diffuse: readonly [number, number, number, number]
}

export type ScreenTriangle = readonly [ScreenVertex, ScreenVertex, ScreenVertex]

// The Direct3D state of the original's draw, in the port's terms (GolDP.dll 0x1000a2c0's output).
export type DrawState = Pick<
  SceneRenderState,
  | 'shading'
  | 'colorOperation'
  | 'isAlphaTestEnabled'
  | 'alphaFunction'
  | 'alphaReference'
  | 'isBlendEnabled'
  | 'sourceBlend'
  | 'destinationBlend'
  | 'filter'
  | 'addressing'
> & {
  readonly isDepthTestEnabled: boolean
  readonly isDepthWriteEnabled: boolean
}

// A triangle as it is drawn: the original's from a DrawIndexedPrimitive, the port's from the viewer's three.js objects.
export type DrawnTriangle = {
  readonly vertices: ScreenTriangle
  // The texture, by the key of the side it comes from (the original's pixel hash, the port's texture name); null without.
  readonly textureKey: string | null
  readonly state: DrawState
  // The port's object (instance and material); the original's triangles have the texture's hash.
  readonly source: string
}

// A triangle in the world, before the camera: what the port's scene objects hold.
export type WorldVertex = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly u: number
  readonly v: number
  readonly diffuse: readonly [number, number, number, number]
}

export type WorldTriangle = {
  readonly vertices: readonly [WorldVertex, WorldVertex, WorldVertex]
  readonly textureKey: string | null
  readonly state: DrawState
  readonly source: string
}

// 16 numbers, row vectors: [x y z 1] * matrix = [x' y' z' w'], and the pixel is x'/w', y'/w'.
export type ScreenMatrix = readonly number[]

// A texture of the port, RGBA 8 bits per channel.
export type PortTexture = {
  readonly width: number
  readonly height: number
  readonly colors: Uint8Array
}

export type RenderMismatchKind = EnumValues<typeof RenderMismatchKindValues>

export type RenderMismatch = {
  readonly kind: RenderMismatchKind
  readonly source: string
  readonly detail: string
  readonly original: DrawnTriangle | null
  readonly port: DrawnTriangle | null
}

// How many triangles of one object differ in one way, with the first example.
export type RenderMismatchGroup = {
  readonly kind: RenderMismatchKind
  readonly source: string
  readonly count: number
  readonly firstDetail: string
  readonly firstOriginal: DrawnTriangle | null
  readonly firstPort: DrawnTriangle | null
}

export type RenderViewportSize = {
  readonly width: number
  readonly height: number
}

export type RenderFrameComparison = {
  readonly originalCount: number
  readonly portCount: number
  readonly matchedCount: number
  // Triangles left out because the original clipped them against the viewport (or the port's leave it).
  readonly clippedCount: number
  readonly groups: readonly RenderMismatchGroup[]
}

export type RenderTolerances = {
  // Pixels: a port vertex this close to the original's is the same vertex.
  readonly positionPixels: number
  readonly textureCoordinate: number
  // 0..255
  readonly colorLevels: number
}

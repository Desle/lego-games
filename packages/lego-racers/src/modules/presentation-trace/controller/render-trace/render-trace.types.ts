import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { SceneRenderState } from '../../../scene/index.ts'
import type { TextureMatch } from './texture-matching.types.ts'
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
  // D3DRENDERSTATE_COLORKEYENABLE: texels equal to the surface's colour key are not drawn.
  readonly isColorKeyEnabled: boolean
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
  // The same corners in the space of the object tree they belong to (a car part's own frame), where the original draws
  // them with a model matrix of its own.
  readonly localVertices: readonly [WorldVertex, WorldVertex, WorldVertex]
  // Which object tree the triangle belongs to (the track, a car part, the tunnel...).
  readonly root: number
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
  // The original's triangles a port triangle was matched with.
  readonly matchedOriginals: readonly DrawnTriangle[]
}

export type RenderTolerances = {
  // Pixels: a port vertex this close to the original's is the same vertex.
  readonly positionPixels: number
  readonly textureCoordinate: number
  // 0..255
  readonly colorLevels: number
}

export type RenderFrameInput = {
  readonly original: readonly DrawnTriangle[]
  readonly port: readonly DrawnTriangle[]
  readonly viewport: RenderViewportSize
  // The port textures that look like each of the original's surfaces, by the surface's hash.
  readonly textureMatches: ReadonlyMap<string, TextureMatch>
  readonly tolerances: RenderTolerances
}

export type PixelPoint = { readonly x: number; readonly y: number }

// What the port's triangle covers once the original's clipping has cut it: a convex polygon on the screen, wound as a
// front-facing triangle.
export type ClippedPolygon = {
  readonly corners: readonly PixelPoint[]
  readonly textureKey: string | null
  readonly source: string
}

export type VertexPairing = {
  readonly permutation: readonly [number, number, number]
  readonly distance: number
}

export type MismatchGroupBuilder = {
  count: number
  readonly kind: RenderMismatchKind
  readonly source: string
  readonly firstDetail: string
  readonly firstOriginal: DrawnTriangle | null
  readonly firstPort: DrawnTriangle | null
}

export type PairingCandidate = { readonly index: number; readonly pairing: VertexPairing }

export type TextureCoordinateWorst = {
  readonly size: number
  readonly left: ScreenVertex | undefined
  readonly right: ScreenVertex | undefined
}

export type ProjectedVertex = ScreenVertex & { readonly clipW: number }

export type MatrixCount = { readonly matrix: ScreenMatrix; readonly triangleCount: number }

export type Rgb = readonly [number, number, number]

export type TextureDifference = { readonly key: string; readonly difference: number }

// A rectangle drawn on the screen: a menu image, a glyph or a fill.
export type QuadPlacement = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  // The original's surface hash, the port's image or font name; null for a fill.
  readonly textureKey: string | null
  readonly source: string
}

export type QuadsInput = {
  readonly original: readonly QuadPlacement[]
  readonly port: readonly QuadPlacement[]
  readonly textureMatches: ReadonlyMap<string, TextureMatch>
  readonly tolerancePixels: number
}

export type QuadGroup = {
  readonly kind: 'missing_in_port' | 'extra_in_port' | 'texture'
  readonly source: string
  readonly count: number
  readonly firstDetail: string
}

export type QuadComparison = {
  readonly originalCount: number
  readonly portCount: number
  readonly matchedCount: number
  readonly groups: readonly QuadGroup[]
}

// A point on the screen.
export type ScreenPoint = {
  readonly x: number
  readonly y: number
}

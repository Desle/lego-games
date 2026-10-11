import type { PortTexture, WorldTriangle } from '@lego-games/lego-racers/presentation-trace'

// The triangles of the viewer's three.js objects in world space and the textures they use, by key.
export type PortTriangles = {
  readonly triangles: readonly WorldTriangle[]
  readonly textures: ReadonlyMap<string, PortTexture>
}

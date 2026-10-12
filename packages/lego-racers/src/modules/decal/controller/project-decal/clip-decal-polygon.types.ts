import type { DecalPolygonVertex } from '../../types/decal.types.ts'

// One edge of the picture the polygon is clipped against.
export type DecalClipStage = {
  // The out-code bit of vertices beyond the edge.
  readonly bit: number
  // Where the edge between two vertices crosses the plane, from the previous vertex.
  readonly getFraction: (previous: DecalPolygonVertex, current: DecalPolygonVertex) => number
  readonly getVertex: (
    previous: DecalPolygonVertex,
    current: DecalPolygonVertex,
    fraction: number
  ) => DecalPolygonVertex
}

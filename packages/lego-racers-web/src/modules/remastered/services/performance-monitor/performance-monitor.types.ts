export type HeaviestRow = {
  readonly label: string
  readonly triangles: number
  readonly segments: number
}

export type PerformanceSnapshot = {
  readonly drawCalls: number
  readonly triangles: number
  readonly lineSegments: number
  readonly shadowDrawCalls: number
  readonly shadowTriangles: number
  readonly geometries: number
  readonly textures: number
  readonly programs: number
  readonly frameMilliseconds: number
  readonly shadowMilliseconds: number
  readonly heapMegabytes: number
  readonly loadMilliseconds: number
}

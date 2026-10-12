import type {
  ClippedPolygon,
  DrawnTriangle,
  RenderFrameComparison,
  RenderFrameInput,
  ScreenMatrix,
  WorldTriangle,
} from './render-trace.types.ts'

export type RootComparisonInput = Omit<RenderFrameInput, 'port'> & {
  readonly port: readonly WorldTriangle[]
  readonly candidates: readonly ScreenMatrix[]
}

// The matrix and space an object tree of the port was projected with.
export type RootChoice = {
  readonly root: number
  readonly candidateIndex: number
  readonly space: 'world' | 'local'
  readonly matchedCount: number
}

export type RootComparison = RenderFrameComparison & {
  readonly choices: readonly RootChoice[]
  // The port's front-facing triangles that reach past the viewport or the near plane, cut as the original's driver cuts them.
  readonly clippedPolygons: readonly ClippedPolygon[]
  // Every port triangle as the original would draw it under the chosen matrices.
  readonly projectedPort: readonly DrawnTriangle[]
}

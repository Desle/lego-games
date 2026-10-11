import type { RenderFrameInput, ScreenMatrix, WorldTriangle } from './render-trace.types.ts'

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

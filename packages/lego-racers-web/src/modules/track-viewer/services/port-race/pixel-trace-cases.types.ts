import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

// A texture of the original whose pixels must show in the viewer: of the screen pixels the original paints with it (on
// the recorded frames), at most this share may differ.
export type WatchedTexture = {
  readonly label: string
  readonly maximumDifferingShare: number
}

export type PixelTraceCase = {
  readonly request: TraceScenarioRequest
  // The share of the 640 x 480 pixels that may differ on the worst recorded frame.
  readonly maximumDifferingShare: number
  readonly watchedTextures: readonly WatchedTexture[]
}

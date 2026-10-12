import type {
  OriginalPresentation,
  PixelTolerance,
} from '@lego-games/lego-racers/presentation-trace'

// A frame both sides recorded: the original's draws (to rasterise) and the viewer's pixels as the browser sent them.
export type RecordedFrameInput = {
  readonly caseName: string
  readonly frame: number
  readonly original: OriginalPresentation
  readonly portColorsBase64: string
  // The colour the frame is cleared to before the draws (red, green, blue).
  readonly clearColor: readonly [number, number, number]
  readonly textureLabels: ReadonlyMap<string, string>
  readonly tolerance: PixelTolerance
  readonly dumpDirectory: string | null
}

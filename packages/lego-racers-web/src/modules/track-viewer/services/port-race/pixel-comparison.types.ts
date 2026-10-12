import type { PixelComparison } from '@lego-games/lego-racers/presentation-trace'
// @check-allow layer-boundaries: a type-only import of the harness' request and result, which the harness' controller owns
import type {
  FrontEndPixelRequest,
  FrontEndPixelResult,
} from '../../controller/front-end-pixel-harness/front-end-pixel-harness.types.ts'
import type {
  PixelTraceRequest,
  PixelTraceResult,
} from '../pixel-trace-harness/pixel-trace-harness.types.ts'

export type PixelFrameResult = {
  readonly frame: number
  readonly comparison: PixelComparison
}

// The browser the viewer is photographed in: a headless Chrome of its own, pointed at a development server of its own.
export type PixelTraceBrowser = {
  readonly runPixelTrace: (request: PixelTraceRequest) => Promise<PixelTraceResult>
  readonly runFrontEndPixelTrace: (request: FrontEndPixelRequest) => Promise<FrontEndPixelResult>
  readonly close: () => Promise<void>
}

// The page of the pixel trace: the runner `installPixelTraceHarness` hangs on the window.
export type PixelTraceWindow = {
  readonly runPixelTrace: (request: PixelTraceRequest) => Promise<PixelTraceResult>
  readonly runFrontEndPixelTrace: (request: FrontEndPixelRequest) => Promise<FrontEndPixelResult>
}

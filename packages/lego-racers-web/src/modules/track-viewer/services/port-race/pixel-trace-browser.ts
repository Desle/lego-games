import { startTracePage } from '../../../../shared/trace-browser/trace-browser.ts'
// @check-allow layer-boundaries: a type-only import of the harness' request and result, which the harness' controller owns
import type {
  FrontEndPixelRequest,
  FrontEndPixelResult,
} from '../../controller/front-end-pixel-harness/front-end-pixel-harness.types.ts'
import type {
  PixelTraceRequest,
  PixelTraceResult,
} from '../pixel-trace-harness/pixel-trace-harness.types.ts'
import type { PixelTraceBrowser, PixelTraceWindow } from './pixel-comparison.types.ts'

export { getChromePath } from '../../../../shared/trace-browser/trace-browser.ts'

const PAGE_PATH = '/?pixel-trace'

// The page that hosts the scripted race runner, on a development server and headless Chrome of its own.
export const startPixelTraceBrowser = async (chromePath: string): Promise<PixelTraceBrowser> => {
  const { page, close } = await startTracePage({
    chromePath,
    pagePath: PAGE_PATH,
    readyFunctionName: 'runPixelTrace',
    port: 5400,
    label: 'pixel trace',
  })
  return Object.freeze({
    runPixelTrace: (request: PixelTraceRequest) =>
      page.evaluate<PixelTraceResult, PixelTraceRequest>(
        (given) => (window as unknown as PixelTraceWindow).runPixelTrace(given),
        request
      ),
    runFrontEndPixelTrace: (request: FrontEndPixelRequest) =>
      page.evaluate<FrontEndPixelResult, FrontEndPixelRequest>(
        (given) => (window as unknown as PixelTraceWindow).runFrontEndPixelTrace(given),
        request
      ),
    close,
  })
}

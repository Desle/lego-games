import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
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

const PACKAGE_DIRECTORY = resolve(import.meta.dirname, '../../../../..')
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
]
// WebGL without a GPU: software ANGLE, so the pixels do not depend on the machine's graphics card.
const CHROME_ARGUMENTS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--disable-gpu-vsync',
]
const PAGE_PATH = '/?pixel-trace'
const RUN_TIMEOUT_MILLISECONDS = 1_800_000

export const getChromePath = (): string | null =>
  // eslint-disable-next-line no-restricted-properties -- a developer tool picks its browser from the shell
  [process.env['CHROME_PATH'], ...CHROME_CANDIDATES].find(
    (path): path is string => path !== undefined && existsSync(path)
  ) ?? null

// A development server of the viewer on a free port of its own (never the one the developer runs) and a headless Chrome
// with its own profile, with the page that hosts the scripted race runner open.
export const startPixelTraceBrowser = async (chromePath: string): Promise<PixelTraceBrowser> => {
  const server = await createServer({
    root: PACKAGE_DIRECTORY,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 5400, strictPort: false },
  })
  await server.listen()
  const address = server.resolvedUrls?.local[0]
  if (address === undefined) throw new Error('The development server has no address')
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: CHROME_ARGUMENTS,
  })
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  page.setDefaultTimeout(RUN_TIMEOUT_MILLISECONDS)
  page.on('pageerror', (error) => console.error('pixel trace page error:', error.message))
  await page.goto(new URL(PAGE_PATH, address).toString())
  await page.waitForFunction(() => 'runPixelTrace' in window)
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
    close: async () => {
      await browser.close()
      await server.close()
    },
  })
}

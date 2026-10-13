import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import type { TracePage, TracePageRequest } from './trace-browser.types.ts'

const PACKAGE_DIRECTORY = resolve(import.meta.dirname, '../../..')
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
const RUN_TIMEOUT_MILLISECONDS = 1_800_000

export const getChromePath = (): string | null =>
  // eslint-disable-next-line no-restricted-properties -- a developer tool picks its browser from the shell
  [process.env['CHROME_PATH'], ...CHROME_CANDIDATES].find(
    (path): path is string => path !== undefined && existsSync(path)
  ) ?? null

// A development server of the viewer on a free port of its own (never the one the developer runs) and a headless Chrome
// with its own profile, with the page open and ready.
export const startTracePage = async (request: TracePageRequest): Promise<TracePage> => {
  const server = await createServer({
    root: PACKAGE_DIRECTORY,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: request.port, strictPort: false },
  })
  await server.listen()
  const address = server.resolvedUrls?.local[0]
  if (address === undefined) throw new Error('The development server has no address')
  const browser = await chromium.launch({
    executablePath: request.chromePath,
    headless: true,
    args: CHROME_ARGUMENTS,
  })
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  page.setDefaultTimeout(RUN_TIMEOUT_MILLISECONDS)
  page.on('pageerror', (error) => console.error(`${request.label} page error:`, error.message))
  await page.goto(new URL(request.pagePath, address).toString())
  await page.waitForFunction((name) => name in window, request.readyFunctionName)
  return Object.freeze({
    page,
    close: async () => {
      await browser.close()
      await server.close()
    },
  })
}

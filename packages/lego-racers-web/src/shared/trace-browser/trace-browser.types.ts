import type { Page } from 'playwright-core'

// Which page of the viewer a trace opens, and the function on its window that says the page is ready.
export type TracePageRequest = {
  readonly chromePath: string
  readonly pagePath: string
  readonly readyFunctionName: string
  // The first port tried for the development server (the next free one is taken).
  readonly port: number
  readonly label: string
}

// A headless Chrome with its own profile, on a development server of the viewer of its own.
export type TracePage = {
  readonly page: Page
  readonly close: () => Promise<void>
}

// A development server of the viewer of its own, at `address`.
export type TraceServer = {
  readonly address: string
  readonly close: () => Promise<void>
}

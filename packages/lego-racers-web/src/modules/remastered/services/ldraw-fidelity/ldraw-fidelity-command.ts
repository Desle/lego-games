import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import {
  createFidelityReport,
  getResultDetails,
  getSortedResults,
  mergeResults,
} from './fidelity-report.ts'
import type { FidelityItem, FidelityResult, FidelityWindow } from './ldraw-fidelity.types.ts'

const PACKAGE_DIRECTORY = resolve(import.meta.dirname, '../../../../..')
const REPOSITORY_DIRECTORY = resolve(PACKAGE_DIRECTORY, '../..')
const DEFAULT_JAM_PATH = join(
  REPOSITORY_DIRECTORY,
  'original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const OUTPUT_DIRECTORY = join(REPOSITORY_DIRECTORY, 'reverse-engineering/ldraw-fidelity')
const RESULTS_PATH = join(OUTPUT_DIRECTORY, 'fidelity.json')
const SHEET_PATH = join(OUTPUT_DIRECTORY, 'worst.png')
const REPORT_PATH = join(REPOSITORY_DIRECTORY, '.docs/remastered-ldraw-fidelity.md')
const PAGE_PATH = '/ldraw-fidelity.html'
const DRAFT_FOLDER = 'drafts'
const DETAIL_LIMIT = 5
const PAGE_TIMEOUT_MILLISECONDS = 600_000
// The same software WebGL as the pixel trace: the pixels do not depend on the machine's graphics card.
const BROWSER_ARGUMENTS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
]

// eslint-disable-next-line no-restricted-properties -- a developer tool finds the folders the dev server serves from the shell, as vite.config.ts does
const environment = process.env
const ldrawRoot = environment['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')
const modelsRoot = environment['LEGO_LDRAW_MODELS_ROOT'] ?? join(homedir(), 'ldraw-models')
const jamPath = environment['LEGO_JAM_PATH'] ?? DEFAULT_JAM_PATH

const getSkipReason = (): string | null => {
  if (!existsSync(jamPath)) return `no LEGO.JAM at ${jamPath}`
  if (!existsSync(join(ldrawRoot, 'LDConfig.ldr'))) return `no LDraw library at ${ldrawRoot}`
  return null
}

const getDraftFiles = (): readonly string[] => {
  const folder = join(modelsRoot, DRAFT_FOLDER)
  return existsSync(folder)
    ? readdirSync(folder)
        .filter((name) => /\.(ldr|mpd)$/i.test(name))
        .sort()
    : []
}

const readPreviousResults = (): readonly FidelityResult[] =>
  existsSync(RESULTS_PATH)
    ? (JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as readonly FidelityResult[])
    : []

const getIsMatch = (item: FidelityItem, filter: string | undefined): boolean =>
  filter === undefined ||
  item.id.toLowerCase().includes(filter.toLowerCase()) ||
  item.name.toLowerCase().includes(filter.toLowerCase())

const run = async () => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2).filter((argument) => argument !== '--'),
    allowPositionals: true,
    options: {
      drafts: { type: 'boolean', default: false },
      sheet: { type: 'string', default: '0' },
      strict: { type: 'boolean', default: false },
    },
  })
  const skipReason = getSkipReason()
  if (skipReason !== null) {
    process.stdout.write(`ldraw-fidelity skipped: ${skipReason}\n`)
    return
  }
  const [filter] = positionals
  const sheetCount = Number(values.sheet)
  const server = await createServer({
    root: PACKAGE_DIRECTORY,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 5410, strictPort: false },
  })
  await server.listen()
  const address = server.resolvedUrls?.local[0]
  if (address === undefined) throw new Error('The development server has no address')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: BROWSER_ARGUMENTS,
  })
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
    page.setDefaultTimeout(PAGE_TIMEOUT_MILLISECONDS)
    page.on('pageerror', (error) => process.stderr.write(`page error: ${error.message}\n`))
    await page.goto(new URL(PAGE_PATH, address).toString())
    await page.waitForFunction(() => 'measureFidelityItem' in window)
    const allItems = await page.evaluate(
      (draftFiles) => (window as unknown as FidelityWindow).listFidelityItems(draftFiles),
      values.drafts ? getDraftFiles() : []
    )
    const items = allItems.filter((item) => getIsMatch(item, filter))
    const measure = (item: FidelityItem, isPictureKept: boolean) =>
      page.evaluate(
        ([given, isKept]) =>
          (window as unknown as FidelityWindow).measureFidelityItem(given, isKept),
        [item, isPictureKept] as const
      )
    const results: FidelityResult[] = []
    const start = performance.now()
    for (const [index, item] of items.entries()) {
      const result = await measure(item, false)
      results.push(result)
      process.stdout.write(
        `[${String(index + 1)}/${String(items.length)}] ${result.score.toFixed(1).padStart(5)} ${result.isPassed ? 'pass' : 'FAIL'} ${item.id}\n`
      )
    }
    const sorted = getSortedResults(results)
    if (sorted.length <= DETAIL_LIMIT) {
      for (const result of sorted) process.stdout.write(`${getResultDetails(result)}\n`)
    }
    mkdirSync(OUTPUT_DIRECTORY, { recursive: true })
    const merged = filter === undefined ? sorted : mergeResults(readPreviousResults(), sorted)
    writeFileSync(RESULTS_PATH, `${JSON.stringify(merged, null, 1)}\n`)
    writeFileSync(REPORT_PATH, createFidelityReport(merged))
    if (sheetCount > 0) {
      const worst = sorted.slice(0, sheetCount)
      for (const result of worst) {
        const item = items.find((candidate) => candidate.id === result.id)
        if (item !== undefined) await measure(item, true)
      }
      const dataUrl = await page.evaluate(
        (rows) => (window as unknown as FidelityWindow).renderFidelitySheet(rows),
        worst.map((result) => ({ id: result.id, label: `${result.score.toFixed(1)} ${result.id}` }))
      )
      writeFileSync(
        SHEET_PATH,
        Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
      )
      process.stdout.write(`Wrote ${SHEET_PATH}\n`)
    }
    const failed = sorted.filter((result) => !result.isPassed).length
    process.stdout.write(
      `${String(sorted.length - failed)} of ${String(sorted.length)} pass (${((performance.now() - start) / 1000).toFixed(0)} s); wrote ${RESULTS_PATH} and ${REPORT_PATH}\n`
    )
    if (values.strict && failed > 0) process.exitCode = 1
  } finally {
    await browser.close()
    await server.close()
  }
}

await run()

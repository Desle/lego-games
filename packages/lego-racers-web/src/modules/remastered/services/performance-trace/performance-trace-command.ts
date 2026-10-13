import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { cpus, homedir, platform, release, tmpdir, totalmem } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import { getChromePath, startTraceServer } from '../../../../shared/trace-browser/trace-browser.ts'
import { installPerformanceTraceGraphics } from './performance-trace-graphics.ts'
import {
  comparePerformance,
  formatPerformanceReport,
  getScenarioMetrics,
  getUpdatedBaseline,
} from './performance-trace-report.ts'
import {
  MEASURED_FRAME_COUNT,
  PERFORMANCE_SCENARIOS,
  PERFORMANCE_VIEWPORTS,
} from './performance-trace-scenarios.ts'
import type {
  BuilderScenarioSubject,
  MachineInformation,
  ModelsSnapshot,
  PerformanceBaseline,
  PerformanceScenario,
  PerformanceScenarioRun,
  PerformanceTraceWindow,
  PerformanceViewport,
  ScenarioMeasurement,
  ScenarioMetrics,
} from './performance-trace.types.ts'

const PACKAGE_DIRECTORY = resolve(import.meta.dirname, '../../../../..')
const REPOSITORY_DIRECTORY = resolve(PACKAGE_DIRECTORY, '../..')
const BASELINE_PATH = join(PACKAGE_DIRECTORY, 'perf-baseline.json')
const OUTPUT_DIRECTORY = join(REPOSITORY_DIRECTORY, 'scratch')
const REPORT_PATH = join(OUTPUT_DIRECTORY, 'perf-report.md')
const RESULTS_PATH = join(OUTPUT_DIRECTORY, 'perf-results.json')
const SERVER_PORT = 5430
const PAGE_TIMEOUT_MILLISECONDS = 900_000
const BUILDER_QUIET_MILLISECONDS = 2000
const BUILDER_TIMEOUT_MILLISECONDS = 240_000
const BUILDER_POLL_MILLISECONDS = 100
const BYTES_PER_GIGABYTE = 1024 ** 3
const BYTES_PER_MEGABYTE = 1024 * 1024
// The machine's own GPU (ANGLE on Metal on a Mac): frame times as the hardware draws them, and its timer queries. `--software`
// draws with SwiftShader as the pixel trace does, slower but the same on every machine.
const BROWSER_ARGUMENTS = [
  '--ignore-gpu-blocklist',
  '--disable-gpu-vsync',
  '--enable-precise-memory-info',
  '--js-flags=--expose-gc',
]
const SOFTWARE_ARGUMENTS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
// What the pages draw: the model files, not the builder's drafts, progress and reference sheets.
const MODEL_FILE = /\.(ldr|mpd|dat)$/i
const IGNORED_MODEL_FOLDERS = new Set(['drafts', 'reference'])

// eslint-disable-next-line no-restricted-properties -- a developer tool finds the folders the dev server serves from the shell, as vite.config.ts does
const environment = process.env
const jamPath =
  environment['LEGO_JAM_PATH'] ??
  join(REPOSITORY_DIRECTORY, 'original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM')
const ldrawRoot = environment['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')
const modelsRoot = environment['LEGO_LDRAW_MODELS_ROOT'] ?? join(homedir(), 'ldraw-models')

const getSkipReason = (chromePath: string | null): string | null => {
  if (!existsSync(jamPath)) return `no LEGO.JAM at ${jamPath}`
  if (!existsSync(join(ldrawRoot, 'LDConfig.ldr'))) return `no LDraw library at ${ldrawRoot}`
  if (!existsSync(modelsRoot)) return `no models folder at ${modelsRoot}`
  if (chromePath === null) return 'no Chrome (set CHROME_PATH)'
  return null
}

const getModelFilePaths = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return IGNORED_MODEL_FOLDERS.has(entry.name) ? [] : getModelFilePaths(path)
    return entry.isFile() && MODEL_FILE.test(entry.name) ? [path] : []
  })

const getSha256 = (content: string | Uint8Array): string =>
  createHash('sha256').update(content).digest('hex')

// Every model file of the models folder by its hash, and one hash over them all: what the numbers were measured with.
const getModelsSnapshot = (directory: string): ModelsSnapshot => {
  const files = Object.fromEntries(
    getModelFilePaths(directory)
      .map((path) => [relative(directory, path), getSha256(readFileSync(path))] as const)
      .sort(([first], [second]) => first.localeCompare(second))
  )
  const hash = getSha256(
    Object.entries(files)
      .map(([path, fileHash]) => `${path} ${fileHash}`)
      .join('\n')
  )
  return { hash, files }
}

const getMachineInformation = (browser: Browser, graphics: string): MachineInformation => ({
  cpu: cpus()[0]?.model ?? 'unknown',
  cores: cpus().length,
  memoryGigabytes: Math.round(totalmem() / BYTES_PER_GIGABYTE),
  platform: `${platform()} ${release()}`,
  node: process.version,
  browser: `Chrome ${browser.version()}`,
  graphics,
})

const getGraphicsName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const context = document.createElement('canvas').getContext('webgl2')
    const extension = context?.getExtension('WEBGL_debug_renderer_info')
    const name: unknown =
      extension === undefined || extension === null
        ? null
        : context?.getParameter(extension.UNMASKED_RENDERER_WEBGL)
    return typeof name === 'string' ? name : 'unknown'
  })

const getHarnessPath = (scenario: PerformanceScenario): string =>
  scenario.isRemastered ? '/?hd&performance-trace' : '/?performance-trace'

const runHarnessScenario = async (
  page: Page,
  address: string,
  scenario: PerformanceScenario,
  run: PerformanceScenarioRun
): Promise<ScenarioMeasurement> => {
  await page.goto(new URL(getHarnessPath(scenario), address).toString())
  await page.waitForFunction(() => 'runPerformanceScenario' in window)
  return page.evaluate<ScenarioMeasurement, PerformanceScenarioRun>(
    (given) => (window as unknown as PerformanceTraceWindow).runPerformanceScenario(given),
    run
  )
}

// The builder page runs itself: it is measured from its navigation until its parse worker has been quiet for a while, then over
// its own animation frames.
const runBuilderScenario = async (
  page: Page,
  address: string,
  subject: BuilderScenarioSubject
): Promise<ScenarioMeasurement> => {
  await page.goto(new URL(`/ldraw-builder.html#${subject.itemId}`, address).toString())
  return page.evaluate(
    async ([frameCount, quietMilliseconds, timeoutMilliseconds, pollMilliseconds, megabyte]) => {
      const { performanceTraceGraphics: graphics } = window as unknown as PerformanceTraceWindow
      const getIsQuiet = () => {
        const parse = graphics.getParseStatistics()
        return (
          parse.requestCount > 0 &&
          parse.pendingCount === 0 &&
          performance.now() - parse.lastSettledAt > quietMilliseconds
        )
      }
      while (!getIsQuiet() && performance.now() < timeoutMilliseconds) {
        await new Promise((resolve) => window.setTimeout(resolve, pollMilliseconds))
      }
      const frames = await graphics.recordAnimationFrames(frameCount)
      Reflect.apply(Reflect.get(window, 'gc') ?? (() => undefined), undefined, [])
      const memory: unknown = Reflect.get(performance, 'memory')
      const used: unknown = memory instanceof Object ? Reflect.get(memory, 'usedJSHeapSize') : 0
      const parse = graphics.getParseStatistics()
      return {
        firstFrameMilliseconds: graphics.getFirstDrawnFrameAt(),
        modelsShownMilliseconds: parse.lastSettledAt,
        frames,
        sceneObjects: null,
        geometries: null,
        totals: graphics.getTotals(),
        parse,
        heapMegabytes: typeof used === 'number' ? used / megabyte : 0,
      }
    },
    [
      MEASURED_FRAME_COUNT,
      BUILDER_QUIET_MILLISECONDS,
      BUILDER_TIMEOUT_MILLISECONDS,
      BUILDER_POLL_MILLISECONDS,
      BYTES_PER_MEGABYTE,
    ] as const
  )
}

// A fresh browser context per scenario and viewport (no cache, no stored drafts, no prepared models), the counters installed
// before the page's own scripts.
const measureScenario = async (
  browser: Browser,
  address: string,
  scenario: PerformanceScenario,
  viewport: PerformanceViewport
): Promise<ScenarioMetrics> => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.devicePixelRatio,
    hasTouch: viewport.isTouchScreen,
  })
  try {
    await context.addInitScript(installPerformanceTraceGraphics)
    const page = await context.newPage()
    page.setDefaultTimeout(PAGE_TIMEOUT_MILLISECONDS)
    page.on('pageerror', (error) => console.error(`${scenario.name} page error:`, error.message))
    const measurement =
      scenario.subject.kind === 'builder'
        ? await runBuilderScenario(page, address, scenario.subject)
        : await runHarnessScenario(page, address, scenario, {
            subject: scenario.subject,
            measuredFrameCount: MEASURED_FRAME_COUNT,
          })
    return getScenarioMetrics(measurement)
  } finally {
    await context.close()
  }
}

const getIsSelected = (name: string, filter: string | undefined): boolean =>
  filter === undefined ||
  filter
    .split(',')
    .filter((part) => part !== '')
    .some((part) => name.toLowerCase().includes(part.toLowerCase()))

const readBaseline = (): PerformanceBaseline | null =>
  existsSync(BASELINE_PATH)
    ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as PerformanceBaseline)
    : null

const run = async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((argument) => argument !== '--'),
    options: {
      'update-baseline': { type: 'boolean', default: false },
      reason: { type: 'string' },
      scenarios: { type: 'string' },
      viewports: { type: 'string' },
      software: { type: 'boolean', default: false },
    },
  })
  const isUpdating = values['update-baseline']
  const reason = values.reason?.trim() ?? ''
  if (isUpdating && reason === '') {
    process.stderr.write(
      'Fix: say why the baseline changes: pnpm run perf -- --update-baseline --reason "…"\n'
    )
    process.exitCode = 1
    return
  }
  const chromePath = getChromePath()
  const skipReason = getSkipReason(chromePath)
  if (skipReason !== null || chromePath === null) {
    process.stdout.write(`perf skipped: ${skipReason ?? 'no Chrome'}\n`)
    return
  }
  const scenarios = PERFORMANCE_SCENARIOS.filter((scenario) =>
    getIsSelected(scenario.name, values.scenarios)
  )
  const viewports = PERFORMANCE_VIEWPORTS.filter((viewport) =>
    getIsSelected(viewport.name, values.viewports)
  )
  // The page reads a copy of the models folder, so nothing the builder writes reaches the real one.
  const scratchModels = mkdtempSync(join(tmpdir(), 'performance-trace-models-'))
  cpSync(modelsRoot, scratchModels, { recursive: true })
  environment['LEGO_LDRAW_MODELS_ROOT'] = scratchModels
  const models = getModelsSnapshot(scratchModels)
  const server = await startTraceServer(SERVER_PORT)
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: [...BROWSER_ARGUMENTS, ...(values.software ? SOFTWARE_ARGUMENTS : [])],
  })
  try {
    const warmUpPage = await browser.newPage()
    warmUpPage.setDefaultTimeout(PAGE_TIMEOUT_MILLISECONDS)
    const machine = getMachineInformation(browser, await getGraphicsName(warmUpPage))
    // Vite transforms the modules on their first request: a page of each kind is opened once, unmeasured.
    await warmUpPage.goto(new URL('/?hd&performance-trace', server.address).toString())
    await warmUpPage.waitForFunction(() => 'runPerformanceScenario' in window)
    await warmUpPage.goto(new URL('/ldraw-builder.html#none', server.address).toString())
    await warmUpPage.close()
    const results: Record<string, Record<string, ScenarioMetrics>> = {}
    for (const scenario of scenarios) {
      for (const viewport of viewports) {
        const started = Date.now()
        const metrics = await measureScenario(browser, server.address, scenario, viewport)
        results[scenario.name] = { ...results[scenario.name], [viewport.name]: metrics }
        process.stdout.write(
          `${scenario.name} @ ${viewport.name}: ${String(metrics.deterministic.drawCalls)} calls, ${String(metrics.deterministic.triangles)} triangles, CPU ${metrics.timing.cpuFrameMedianMilliseconds.toFixed(2)} ms (${String(Math.round((Date.now() - started) / 1000))} s)\n`
        )
      }
    }
    const baseline = readBaseline()
    const comparison = comparePerformance(baseline, results, models)
    const report = formatPerformanceReport({
      comparison,
      results,
      machine,
      baselineMachine: baseline?.machine ?? null,
      models,
    })
    mkdirSync(OUTPUT_DIRECTORY, { recursive: true })
    writeFileSync(REPORT_PATH, report)
    writeFileSync(RESULTS_PATH, `${JSON.stringify({ machine, models, results }, null, 2)}\n`)
    process.stdout.write(`\n${report}\nReport: ${REPORT_PATH}\n`)
    if (isUpdating) {
      const updated = getUpdatedBaseline(baseline, results, machine, models, reason)
      writeFileSync(BASELINE_PATH, `${JSON.stringify(updated, null, 2)}\n`)
      process.stdout.write(`Baseline updated: ${BASELINE_PATH}\n`)
    } else if (comparison.failures.length > 0) {
      process.stderr.write(
        'Fix: find what the change adds to these scenes (`?hd&perf`, `legoHeaviest()`) and remove it, or, when the cost is wanted, update the baseline in the same PR with `pnpm run perf -- --update-baseline --reason "…"` and state the deltas in the PR\n'
      )
      process.exitCode = 1
    }
  } finally {
    await browser.close()
    await server.close()
    rmSync(scratchModels, { recursive: true, force: true })
    environment['LEGO_LDRAW_MODELS_ROOT'] = modelsRoot
  }
}

await run()

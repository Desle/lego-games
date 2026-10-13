import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { PowerUpUse } from '../hd-coverage/hd-coverage.types.ts'

// A fixed window the trace opens the page in: CSS pixels and the device pixel ratio.
export type PerformanceViewport = {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly devicePixelRatio: number
  readonly isTouchScreen: boolean
}

// The front end from the start, stepped to its main menu and measured there.
export type MenuScenarioSubject = {
  readonly kind: 'menu'
  readonly firstScreenId: number | null
  readonly settleSteps: number
}

// A single race of the time trial track, stepped to `measuredFrame` and measured over the frames before it.
export type RaceScenarioSubject = {
  readonly kind: 'race'
  readonly racerCount: number
  readonly isPlayerSliding: boolean
  readonly powerUpUses: readonly PowerUpUse[]
  readonly measuredFrame: number
}

// The LDraw builder page with an item of its queue open (its address's hash), measured over its own animation frames.
export type BuilderScenarioSubject = {
  readonly kind: 'builder'
  readonly itemId: string
}

export type PerformanceScenarioSubject = MenuScenarioSubject | RaceScenarioSubject

export type PerformanceScenario = {
  readonly name: string
  readonly isRemastered: boolean
  readonly subject: PerformanceScenarioSubject | BuilderScenarioSubject
}

// Cumulative draws of every WebGL context of the page since it opened, and the objects alive in them now.
export type GraphicsTotals = {
  readonly drawCalls: number
  readonly triangles: number
  readonly lines: number
  readonly points: number
  readonly programs: number
  readonly textures: number
  readonly buffers: number
  readonly vertexArrays: number
}

// What one frame drew and cost: CPU milliseconds between its start and end, and the GPU's when the timer query extension exists.
export type FrameSample = {
  readonly cpuMilliseconds: number
  readonly gpuMilliseconds: number | null
  readonly drawCalls: number
  readonly triangles: number
  readonly lines: number
  readonly points: number
}

// The LDraw parse requests the page sent its worker: how many, their summed and their overlapping (wall) time.
export type ParseStatistics = {
  readonly requestCount: number
  readonly requestMilliseconds: number
  readonly busyMilliseconds: number
  readonly pendingCount: number
  // `performance.now()` when the last pending request came back (0: none yet).
  readonly lastSettledAt: number
}

export type FrameHandle = {
  readonly index: number
}

// A GPU timer query a frame opened on a context.
export type TimerQuery = readonly [WebGL2RenderingContext, WebGLQuery]

// A frame being measured: where the counters stood at its start, and the timer queries it opened.
export type OpenFrame = {
  readonly start: number
  readonly totals: GraphicsTotals
  readonly queries: readonly TimerQuery[]
}

// A measured frame waiting for its GPU time; `key` is its animation frame's timestamp (-1: a frame the harness drew).
export type EndedFrame = {
  readonly key: number
  readonly sample: FrameSample
  readonly queries: readonly TimerQuery[]
}

// The counters the trace's init script hangs on the window before the page's own scripts run.
export type PerformanceTraceGraphics = {
  readonly getTotals: () => GraphicsTotals
  readonly getParseStatistics: () => ParseStatistics
  readonly beginFrame: () => FrameHandle
  readonly endFrame: (handle: FrameHandle) => void
  // Every frame ended since the last reset, with its GPU time once the queries have answered.
  readonly collectFrames: () => Promise<readonly FrameSample[]>
  readonly resetFrames: () => void
  // Measures the page's own animation frames (all `requestAnimationFrame` callbacks of one frame together).
  readonly recordAnimationFrames: (count: number) => Promise<readonly FrameSample[]>
  // `performance.now()` at the end of the first animation frame that drew something (0: none yet).
  readonly getFirstDrawnFrameAt: () => number
}

export type PerformanceTraceWindow = {
  readonly performanceTraceGraphics: PerformanceTraceGraphics
  readonly runPerformanceScenario: (
    scenario: PerformanceScenarioRun
  ) => Promise<ScenarioMeasurement>
}

export type PerformanceScenarioRun = {
  readonly subject: PerformanceScenarioSubject
  readonly measuredFrameCount: number
}

// What the page measured in a scenario. Times are milliseconds from the scenario's start.
export type ScenarioMeasurement = {
  readonly firstFrameMilliseconds: number
  readonly modelsShownMilliseconds: number | null
  readonly frames: readonly FrameSample[]
  readonly sceneObjects: number | null
  readonly geometries: number | null
  readonly totals: GraphicsTotals
  readonly parse: ParseStatistics
  readonly heapMegabytes: number
}

// Same on every run of the same code, models and viewport: compared with the baseline and failed above its tolerance.
export type DeterministicMetrics = {
  readonly drawCalls: number
  readonly triangles: number
  readonly lines: number
  readonly points: number
  readonly programs: number
  readonly textures: number
  readonly buffers: number
  readonly geometries: number | null
  readonly sceneObjects: number | null
  readonly ldrawParses: number
}

// Noisy and bound to the machine: reported against the baseline, never failed.
export type TimingMetrics = {
  readonly firstFrameMilliseconds: number
  readonly modelsShownMilliseconds: number | null
  readonly cpuFrameMedianMilliseconds: number
  readonly cpuFrameP95Milliseconds: number
  readonly gpuFrameMedianMilliseconds: number | null
  readonly gpuFrameP95Milliseconds: number | null
  readonly heapMegabytes: number
  readonly ldrawParseMilliseconds: number
}

export type ScenarioMetrics = {
  readonly deterministic: DeterministicMetrics
  readonly timing: TimingMetrics
}

export type DeterministicMetricName = keyof DeterministicMetrics
export type TimingMetricName = keyof TimingMetrics

export type MetricDefinition<Name> = {
  readonly name: Name
  readonly label: string
  // The largest rise over the baseline, as a fraction, that is not flagged.
  readonly tolerance: number
  // The largest change, in the metric's unit, that is not flagged whatever its fraction.
  readonly minimumChange: number
}

export type MetricValues = {
  readonly baseline: number | null
  readonly current: number | null
  // The baseline has no entry for the scenario and viewport.
  readonly isBaselineMissing: boolean
}

// Scenario name, then viewport name.
export type ScenarioResults = Readonly<Record<string, Readonly<Record<string, ScenarioMetrics>>>>

export type MachineInformation = {
  readonly cpu: string
  readonly cores: number
  readonly memoryGigabytes: number
  readonly platform: string
  readonly node: string
  readonly browser: string
  readonly graphics: string
}

// The models folder the numbers were measured with: a hash over all its files and each file's own.
export type ModelsSnapshot = {
  readonly hash: string
  readonly files: Readonly<Record<string, string>>
}

export type PerformanceBaseline = {
  readonly reason: string
  readonly machine: MachineInformation
  readonly models: ModelsSnapshot
  readonly results: ScenarioResults
}

export const MetricStatus = createEnum({
  OK: 'ok',
  REGRESSION: 'regression',
  WARNING: 'warning',
  IMPROVED: 'improved',
  NEW: 'new',
})
export type MetricStatus = EnumValues<typeof MetricStatus>

export type MetricComparison = {
  readonly scenario: string
  readonly viewport: string
  readonly metric: string
  readonly label: string
  readonly isDeterministic: boolean
  readonly baseline: number | null
  readonly current: number | null
  // The change as a fraction of the baseline (null: no baseline, or a baseline of 0 with a change).
  readonly change: number | null
  readonly status: MetricStatus
}

export type ModelsChange = {
  readonly added: readonly string[]
  readonly removed: readonly string[]
  readonly changed: readonly string[]
}

export type PerformanceComparison = {
  readonly comparisons: readonly MetricComparison[]
  readonly modelsChange: ModelsChange
  readonly isModelsChanged: boolean
  // Deterministic rises above tolerance; with changed models they only warn.
  readonly failures: readonly MetricComparison[]
}

export type PerformanceReportRequest = {
  readonly comparison: PerformanceComparison
  readonly results: ScenarioResults
  readonly machine: MachineInformation
  readonly baselineMachine: MachineInformation | null
  readonly models: ModelsSnapshot
}

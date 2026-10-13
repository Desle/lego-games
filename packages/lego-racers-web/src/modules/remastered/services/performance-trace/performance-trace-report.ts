import { MetricStatus } from './performance-trace.types.ts'
import type {
  DeterministicMetricName,
  FrameSample,
  MachineInformation,
  MetricComparison,
  MetricDefinition,
  MetricValues,
  ModelsChange,
  ModelsSnapshot,
  PerformanceBaseline,
  PerformanceComparison,
  PerformanceReportRequest,
  ScenarioMeasurement,
  ScenarioMetrics,
  ScenarioResults,
  TimingMetricName,
} from './performance-trace.types.ts'

// What a change may add before it fails: the same scene drawn by the same code differs by nothing, so a few percent is a real cost.
const DETERMINISTIC_TOLERANCE = 0.05
// Frame times move with the machine's load and temperature: only a large rise is worth a look.
const TIMING_TOLERANCE = 0.2
const PERCENT = 100
const P95 = 0.95

const getDeterministicMetric = (
  name: DeterministicMetricName,
  label: string
): MetricDefinition<DeterministicMetricName> => ({
  name,
  label,
  tolerance: DETERMINISTIC_TOLERANCE,
  minimumChange: 0,
})

// A timing is flagged only when it also moved by more than `minimumChange` (milliseconds, megabytes): below a millisecond the
// browser's clock (0.1 ms steps) and the machine's other work are most of the difference.
const getTimingMetric = (
  name: TimingMetricName,
  label: string,
  minimumChange: number
): MetricDefinition<TimingMetricName> => ({
  name,
  label,
  tolerance: TIMING_TOLERANCE,
  minimumChange,
})

export const DETERMINISTIC_METRICS: readonly MetricDefinition<DeterministicMetricName>[] = [
  getDeterministicMetric('drawCalls', 'draw calls'),
  getDeterministicMetric('triangles', 'triangles'),
  getDeterministicMetric('lines', 'line segments'),
  getDeterministicMetric('points', 'points'),
  getDeterministicMetric('programs', 'shader programs'),
  getDeterministicMetric('textures', 'textures'),
  getDeterministicMetric('buffers', 'GL buffers'),
  getDeterministicMetric('geometries', 'geometries'),
  getDeterministicMetric('sceneObjects', 'scene objects'),
  getDeterministicMetric('ldrawParses', 'LDraw parses'),
]

export const TIMING_METRICS: readonly MetricDefinition<TimingMetricName>[] = [
  getTimingMetric('firstFrameMilliseconds', 'first frame ms', 100),
  getTimingMetric('modelsShownMilliseconds', 'all LDraw shown ms', 100),
  getTimingMetric('cpuFrameMedianMilliseconds', 'CPU frame median ms', 1),
  getTimingMetric('cpuFrameP95Milliseconds', 'CPU frame p95 ms', 2),
  getTimingMetric('gpuFrameMedianMilliseconds', 'GPU frame median ms', 1),
  getTimingMetric('gpuFrameP95Milliseconds', 'GPU frame p95 ms', 2),
  getTimingMetric('heapMegabytes', 'JS heap MB', 10),
  getTimingMetric('ldrawParseMilliseconds', 'LDraw busy ms', 100),
]

// The value at a fraction of the sorted values (nearest rank); null for no values.
export const getPercentile = (values: readonly number[], fraction: number): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((first, second) => first - second)
  const rank = Math.min(Math.max(Math.ceil(fraction * sorted.length) - 1, 0), sorted.length - 1)
  return sorted[rank] ?? null
}

export const getMedian = (values: readonly number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2
}

const getGpuValues = (frames: readonly FrameSample[]): readonly number[] => {
  const values = frames.flatMap((frame) =>
    frame.gpuMilliseconds === null ? [] : [frame.gpuMilliseconds]
  )
  // A GPU time over fewer than half the frames (queries lost to a disjoint GPU) says too little.
  return values.length * 2 >= frames.length ? values : []
}

// The metrics of one scenario: the counts of its last measured frame and the times over all of them.
export const getScenarioMetrics = (measurement: ScenarioMeasurement): ScenarioMetrics => {
  const lastFrame = measurement.frames.at(-1)
  const cpuValues = measurement.frames.map((frame) => frame.cpuMilliseconds)
  const gpuValues = getGpuValues(measurement.frames)
  return {
    deterministic: {
      drawCalls: lastFrame?.drawCalls ?? 0,
      triangles: lastFrame?.triangles ?? 0,
      lines: lastFrame?.lines ?? 0,
      points: lastFrame?.points ?? 0,
      programs: measurement.totals.programs,
      textures: measurement.totals.textures,
      buffers: measurement.totals.buffers,
      geometries: measurement.geometries,
      sceneObjects: measurement.sceneObjects,
      ldrawParses: measurement.parse.requestCount,
    },
    timing: {
      firstFrameMilliseconds: measurement.firstFrameMilliseconds,
      modelsShownMilliseconds: measurement.modelsShownMilliseconds,
      cpuFrameMedianMilliseconds: getMedian(cpuValues) ?? 0,
      cpuFrameP95Milliseconds: getPercentile(cpuValues, P95) ?? 0,
      gpuFrameMedianMilliseconds: getMedian(gpuValues),
      gpuFrameP95Milliseconds: getPercentile(gpuValues, P95),
      heapMegabytes: measurement.heapMegabytes,
      ldrawParseMilliseconds: measurement.parse.busyMilliseconds,
    },
  }
}

export const getModelsChange = (
  baseline: ModelsSnapshot | null,
  current: ModelsSnapshot
): ModelsChange => {
  if (baseline === null) return { added: [], removed: [], changed: [] }
  const baselineNames = Object.keys(baseline.files)
  const currentNames = Object.keys(current.files)
  return {
    added: currentNames.filter((name) => baseline.files[name] === undefined).sort(),
    removed: baselineNames.filter((name) => current.files[name] === undefined).sort(),
    changed: currentNames
      .filter(
        (name) => baseline.files[name] !== undefined && baseline.files[name] !== current.files[name]
      )
      .sort(),
  }
}

const getChange = (baseline: number, current: number): number | null => {
  if (baseline === 0) return current === 0 ? 0 : null
  return (current - baseline) / baseline
}

const getStatus = <Name extends string>(
  baseline: number | null,
  current: number | null,
  definition: MetricDefinition<Name>,
  isDeterministic: boolean
): MetricStatus => {
  if (baseline === null) return current === null ? MetricStatus.OK : MetricStatus.NEW
  if (current === null) return MetricStatus.WARNING
  const { tolerance, minimumChange } = definition
  const isMoved = Math.abs(current - baseline) > minimumChange
  const isRise = baseline === 0 ? current > 0 : current > baseline * (1 + tolerance)
  if (isRise && isMoved) return isDeterministic ? MetricStatus.REGRESSION : MetricStatus.WARNING
  return isMoved && current < baseline * (1 - tolerance) ? MetricStatus.IMPROVED : MetricStatus.OK
}

const compareMetric = <Name extends string>(
  scenario: string,
  viewport: string,
  definition: MetricDefinition<Name>,
  values: MetricValues,
  isDeterministic: boolean
): MetricComparison => ({
  scenario,
  viewport,
  metric: definition.name,
  label: definition.label,
  isDeterministic,
  baseline: values.baseline,
  current: values.current,
  change:
    values.baseline === null || values.current === null
      ? null
      : getChange(values.baseline, values.current),
  status: values.isBaselineMissing
    ? MetricStatus.NEW
    : getStatus(values.baseline, values.current, definition, isDeterministic),
})

const getScenarioComparisons = (
  scenario: string,
  viewport: string,
  current: ScenarioMetrics,
  baseline: ScenarioMetrics | null
): readonly MetricComparison[] => [
  ...DETERMINISTIC_METRICS.map((definition) =>
    compareMetric(
      scenario,
      viewport,
      definition,
      {
        baseline: baseline?.deterministic[definition.name] ?? null,
        current: current.deterministic[definition.name],
        isBaselineMissing: baseline === null,
      },
      true
    )
  ),
  ...TIMING_METRICS.map((definition) =>
    compareMetric(
      scenario,
      viewport,
      definition,
      {
        baseline: baseline?.timing[definition.name] ?? null,
        current: current.timing[definition.name],
        isBaselineMissing: baseline === null,
      },
      false
    )
  ),
]

// Every metric of every measured scenario against the baseline. A deterministic rise above its tolerance fails, unless the models
// folder differs from the baseline's: then the numbers cannot be compared and the rise only warns.
export const comparePerformance = (
  baseline: PerformanceBaseline | null,
  results: ScenarioResults,
  models: ModelsSnapshot
): PerformanceComparison => {
  const comparisons = Object.entries(results).flatMap(([scenario, viewports]) =>
    Object.entries(viewports).flatMap(([viewport, metrics]) =>
      getScenarioComparisons(
        scenario,
        viewport,
        metrics,
        baseline?.results[scenario]?.[viewport] ?? null
      )
    )
  )
  const isModelsChanged = baseline !== null && baseline.models.hash !== models.hash
  return {
    comparisons,
    modelsChange: getModelsChange(baseline?.models ?? null, models),
    isModelsChanged,
    failures: isModelsChanged
      ? []
      : comparisons.filter((comparison) => comparison.status === MetricStatus.REGRESSION),
  }
}

// The baseline with these results in place of the ones they measured again; the others are kept.
export const getUpdatedBaseline = (
  previous: PerformanceBaseline | null,
  results: ScenarioResults,
  machine: MachineInformation,
  models: ModelsSnapshot,
  reason: string
): PerformanceBaseline => ({
  reason,
  machine,
  models,
  results: Object.fromEntries(
    [...new Set([...Object.keys(previous?.results ?? {}), ...Object.keys(results)])]
      .sort()
      .map((scenario) => [
        scenario,
        { ...(previous?.results[scenario] ?? {}), ...(results[scenario] ?? {}) },
      ])
  ),
})

const getIsWhole = (name: string): boolean =>
  DETERMINISTIC_METRICS.some((definition) => definition.name === name)

export const formatValue = (value: number | null, isWhole: boolean): string => {
  if (value === null) return '–'
  return isWhole ? Math.round(value).toLocaleString('en-US') : value.toFixed(1)
}

export const formatChange = (change: number | null): string => {
  if (change === null) return ''
  const percent = change * PERCENT
  if (Math.abs(percent) < 0.05) return '±0 %'
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)} %`
}

const STATUS_MARKS: Readonly<Record<MetricStatus, string>> = {
  ok: '',
  regression: ' **FAIL**',
  warning: ' *slower*',
  improved: ' *better*',
  new: ' *new*',
}

const formatCell = (comparison: MetricComparison | undefined): string => {
  if (comparison === undefined) return '–'
  const value = formatValue(comparison.current, getIsWhole(comparison.metric))
  const change = formatChange(comparison.change)
  return `${value}${change === '' ? '' : ` (${change})`}${STATUS_MARKS[comparison.status]}`
}

const SUMMARY_METRICS: readonly string[] = [
  'drawCalls',
  'triangles',
  'programs',
  'textures',
  'cpuFrameMedianMilliseconds',
  'gpuFrameMedianMilliseconds',
  'firstFrameMilliseconds',
  'modelsShownMilliseconds',
]

const getLabel = (name: string): string =>
  [...DETERMINISTIC_METRICS, ...TIMING_METRICS].find((definition) => definition.name === name)
    ?.label ?? name

const formatMachine = (machine: MachineInformation): string =>
  `${machine.cpu} (${String(machine.cores)} cores, ${String(machine.memoryGigabytes)} GB), ${machine.platform}, Node ${machine.node}, ${machine.browser}, ${machine.graphics}`

const formatTable = (
  header: readonly string[],
  rows: readonly (readonly string[])[]
): readonly string[] => [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
]

const formatFlag = (comparison: MetricComparison): string =>
  `- ${comparison.scenario} @ ${comparison.viewport}: ${comparison.label} ${formatValue(comparison.baseline, getIsWhole(comparison.metric))} → ${formatValue(comparison.current, getIsWhole(comparison.metric))} (${formatChange(comparison.change)})`

// The report for a pull request: a summary table per viewport with each value's change against the baseline, what was flagged,
// the machine and the models folder, and every metric in a folded section.
export const formatPerformanceReport = (request: PerformanceReportRequest): string => {
  const { comparison, machine, baselineMachine, models } = request
  const regressions = comparison.comparisons.filter(
    (entry) => entry.status === MetricStatus.REGRESSION
  )
  const warnings = comparison.comparisons.filter((entry) => entry.status === MetricStatus.WARNING)
  const viewports = [...new Set(comparison.comparisons.map((entry) => entry.viewport))]
  const scenarios = [...new Set(comparison.comparisons.map((entry) => entry.scenario))]
  const find = (scenario: string, viewport: string, metric: string) =>
    comparison.comparisons.find(
      (entry) =>
        entry.scenario === scenario && entry.viewport === viewport && entry.metric === metric
    )
  const { added, removed, changed } = comparison.modelsChange
  return [
    '## Performance trace',
    '',
    `${String(regressions.length)} deterministic regressions${comparison.isModelsChanged && regressions.length > 0 ? ' (not failed: the models folder differs from the baseline)' : ''}, ${String(warnings.length)} timing warnings. Deterministic metrics fail above +${String(DETERMINISTIC_TOLERANCE * PERCENT)} %, timing metrics warn above +${String(TIMING_TOLERANCE * PERCENT)} %.`,
    '',
    ...(comparison.isModelsChanged
      ? [
          `**The models folder differs from the baseline's** (added ${added.join(', ') || 'none'}; removed ${removed.join(', ') || 'none'}; changed ${changed.join(', ') || 'none'}): measure the baseline again with the same folder, or update it.`,
          '',
        ]
      : []),
    ...viewports.flatMap((viewport) => [
      `### ${viewport}`,
      '',
      ...formatTable(
        ['scenario', ...SUMMARY_METRICS.map(getLabel)],
        scenarios.map((scenario) => [
          scenario,
          ...SUMMARY_METRICS.map((metric) => formatCell(find(scenario, viewport, metric))),
        ])
      ),
      '',
    ]),
    ...(regressions.length > 0 ? ['Regressions:', ...regressions.map(formatFlag), ''] : []),
    ...(warnings.length > 0
      ? ['Slower (timing, report only):', ...warnings.map(formatFlag), '']
      : []),
    `Machine: ${formatMachine(machine)}`,
    ...(baselineMachine === null ? [] : [`Baseline machine: ${formatMachine(baselineMachine)}`]),
    `Models folder: ${models.hash.slice(0, 12)} (${String(Object.keys(models.files).length)} files)`,
    '',
    '<details><summary>Every metric</summary>',
    '',
    ...formatTable(
      ['scenario', 'viewport', 'metric', 'baseline', 'current', 'change'],
      comparison.comparisons.map((entry) => [
        entry.scenario,
        entry.viewport,
        entry.label,
        formatValue(entry.baseline, getIsWhole(entry.metric)),
        formatValue(entry.current, getIsWhole(entry.metric)),
        `${formatChange(entry.change)}${STATUS_MARKS[entry.status]}`,
      ])
    ),
    '',
    '</details>',
    '',
  ].join('\n')
}

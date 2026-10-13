import { MetricStatus } from './performance-trace.types.ts'
import type {
  FrameSample,
  MachineInformation,
  ModelsSnapshot,
  PerformanceBaseline,
  ScenarioMeasurement,
  ScenarioMetrics,
} from './performance-trace.types.ts'
import {
  comparePerformance,
  formatChange,
  formatPerformanceReport,
  getMedian,
  getPercentile,
  getScenarioMetrics,
  getUpdatedBaseline,
} from './performance-trace-report.ts'

const MACHINE: MachineInformation = {
  cpu: 'Test CPU',
  cores: 8,
  memoryGigabytes: 16,
  platform: 'test',
  node: 'v24',
  browser: 'Chrome 1',
  graphics: 'Test GPU',
}

const MODELS: ModelsSnapshot = { hash: 'aaaa', files: { 'CAR.ldr': '1', 'drivers/RR.ldr': '2' } }

const getMetrics = (drawCalls: number, cpuMilliseconds: number): ScenarioMetrics => ({
  deterministic: {
    drawCalls,
    triangles: 1000,
    lines: 10,
    points: 0,
    programs: 10,
    textures: 5,
    buffers: 50,
    geometries: 20,
    sceneObjects: null,
    ldrawParses: 3,
  },
  timing: {
    firstFrameMilliseconds: 100,
    modelsShownMilliseconds: null,
    cpuFrameMedianMilliseconds: cpuMilliseconds,
    cpuFrameP95Milliseconds: cpuMilliseconds,
    gpuFrameMedianMilliseconds: null,
    gpuFrameP95Milliseconds: null,
    heapMegabytes: 50,
    ldrawParseMilliseconds: 0,
  },
})

const getBaseline = (drawCalls: number, cpuMilliseconds: number): PerformanceBaseline => ({
  reason: 'first',
  machine: MACHINE,
  models: MODELS,
  results: { race: { desktop: getMetrics(drawCalls, cpuMilliseconds) } },
})

const getFrame = (cpuMilliseconds: number, gpuMilliseconds: number | null): FrameSample => ({
  cpuMilliseconds,
  gpuMilliseconds,
  drawCalls: cpuMilliseconds,
  triangles: 3,
  lines: 2,
  points: 1,
})

const findStatus = (
  comparison: ReturnType<typeof comparePerformance>,
  metric: string
): string | undefined => comparison.comparisons.find((entry) => entry.metric === metric)?.status

describe('getMedian and getPercentile', () => {
  it('takes the middle value, or the mean of the two middle ones', () => {
    // Arrange
    const odd = [5, 1, 3]
    const even = [4, 1, 3, 2]

    // Act
    const medians = [getMedian(odd), getMedian(even), getMedian([])]

    // Assert
    expect(medians).toEqual([3, 2.5, null])
  })

  it('takes the nearest rank for a percentile', () => {
    // Arrange
    const values = Array.from({ length: 20 }, (_, index) => 20 - index)

    // Act
    const percentiles = [
      getPercentile(values, 0.95),
      getPercentile(values, 1),
      getPercentile([], 0.5),
    ]

    // Assert
    expect(percentiles).toEqual([19, 20, null])
  })
})

describe('getScenarioMetrics', () => {
  it('counts the last measured frame and times all of them', () => {
    // Arrange
    const measurement: ScenarioMeasurement = {
      firstFrameMilliseconds: 12,
      modelsShownMilliseconds: 34,
      frames: [getFrame(1, 0.5), getFrame(3, 1.5), getFrame(2, null)],
      sceneObjects: 7,
      geometries: 6,
      totals: {
        drawCalls: 99,
        triangles: 99,
        lines: 99,
        points: 99,
        programs: 4,
        textures: 5,
        buffers: 8,
        vertexArrays: 2,
      },
      parse: {
        requestCount: 9,
        requestMilliseconds: 100,
        busyMilliseconds: 40,
        pendingCount: 0,
        lastSettledAt: 30,
      },
      heapMegabytes: 64,
    }

    // Act
    const metrics = getScenarioMetrics(measurement)

    // Assert
    expect(metrics).toEqual({
      deterministic: {
        drawCalls: 2,
        triangles: 3,
        lines: 2,
        points: 1,
        programs: 4,
        textures: 5,
        buffers: 8,
        geometries: 6,
        sceneObjects: 7,
        ldrawParses: 9,
      },
      timing: {
        firstFrameMilliseconds: 12,
        modelsShownMilliseconds: 34,
        cpuFrameMedianMilliseconds: 2,
        cpuFrameP95Milliseconds: 3,
        gpuFrameMedianMilliseconds: 1,
        gpuFrameP95Milliseconds: 1.5,
        heapMegabytes: 64,
        ldrawParseMilliseconds: 40,
      },
    })
  })
})

describe('comparePerformance', () => {
  it('fails a deterministic rise above 5 % and passes one within it', () => {
    // Arrange
    const baseline = getBaseline(100, 4)

    // Act
    const above = comparePerformance(baseline, { race: { desktop: getMetrics(106, 4) } }, MODELS)
    const within = comparePerformance(baseline, { race: { desktop: getMetrics(105, 4) } }, MODELS)

    // Assert
    expect(above.failures.map((failure) => [failure.metric, failure.change])).toEqual([
      ['drawCalls', 0.06],
    ])
    expect(within.failures).toEqual([])
    expect(findStatus(within, 'drawCalls')).toBe(MetricStatus.OK)
  })

  it('fails a count that rises from zero', () => {
    // Arrange
    const baseline = getBaseline(0, 4)

    // Act
    const comparison = comparePerformance(baseline, { race: { desktop: getMetrics(1, 4) } }, MODELS)

    // Assert
    expect(findStatus(comparison, 'drawCalls')).toBe(MetricStatus.REGRESSION)
    expect(comparison.failures).toHaveLength(1)
  })

  it('only warns when a timing rises above 20 % and marks a drop as better', () => {
    // Arrange
    const baseline = getBaseline(100, 4)

    // Act
    const slower = comparePerformance(baseline, { race: { desktop: getMetrics(100, 6) } }, MODELS)
    const faster = comparePerformance(baseline, { race: { desktop: getMetrics(90, 2) } }, MODELS)

    // Assert
    expect(findStatus(slower, 'cpuFrameMedianMilliseconds')).toBe(MetricStatus.WARNING)
    expect(slower.failures).toEqual([])
    expect(findStatus(faster, 'cpuFrameMedianMilliseconds')).toBe(MetricStatus.IMPROVED)
    expect(findStatus(faster, 'drawCalls')).toBe(MetricStatus.IMPROVED)
  })

  it('marks a scenario the baseline lacks as new', () => {
    // Arrange
    const baseline = getBaseline(100, 4)

    // Act
    const comparison = comparePerformance(baseline, { race: { phone: getMetrics(500, 4) } }, MODELS)

    // Assert
    expect(new Set(comparison.comparisons.map((entry) => entry.status))).toEqual(
      new Set([MetricStatus.NEW])
    )
    expect(comparison.comparisons[0]?.current).toBe(500)
    expect(comparison.failures).toEqual([])
  })

  it('does not fail when the models folder differs from the baseline, and says what changed', () => {
    // Arrange
    const baseline = getBaseline(100, 4)
    const models: ModelsSnapshot = { hash: 'bbbb', files: { 'CAR.ldr': '9', 'NEW.ldr': '3' } }

    // Act
    const comparison = comparePerformance(
      baseline,
      { race: { desktop: getMetrics(200, 4) } },
      models
    )

    // Assert
    expect(comparison.isModelsChanged).toBe(true)
    expect(comparison.failures).toEqual([])
    expect(comparison.modelsChange).toEqual({
      added: ['NEW.ldr'],
      removed: ['drivers/RR.ldr'],
      changed: ['CAR.ldr'],
    })
  })
})

describe('comparePerformance on small timings', () => {
  it('does not warn about a frame time that moved by less than a millisecond', () => {
    // Arrange
    const baseline = getBaseline(100, 0.2)

    // Act
    const comparison = comparePerformance(
      baseline,
      { race: { desktop: getMetrics(100, 0.6) } },
      MODELS
    )

    // Assert
    expect(findStatus(comparison, 'cpuFrameMedianMilliseconds')).toBe(MetricStatus.OK)
  })
})

describe('getUpdatedBaseline', () => {
  it('replaces what was measured again and keeps the rest', () => {
    // Arrange
    const previous: PerformanceBaseline = {
      ...getBaseline(100, 4),
      results: {
        race: { desktop: getMetrics(100, 4), phone: getMetrics(50, 4) },
        menu: { desktop: getMetrics(5, 1) },
      },
    }

    // Act
    const updated = getUpdatedBaseline(
      previous,
      { race: { desktop: getMetrics(120, 4) } },
      MACHINE,
      MODELS,
      'particles drawn as LDraw parts'
    )

    // Assert
    expect(updated.reason).toBe('particles drawn as LDraw parts')
    expect(updated.results['race']?.['desktop']?.deterministic.drawCalls).toBe(120)
    expect(updated.results['race']?.['phone']?.deterministic.drawCalls).toBe(50)
    expect(updated.results['menu']?.['desktop']?.deterministic.drawCalls).toBe(5)
  })
})

describe('formatPerformanceReport', () => {
  it('prints each scenario with its values and changes, and the regressions', () => {
    // Arrange
    const results = { race: { desktop: getMetrics(110, 4) } }
    const comparison = comparePerformance(getBaseline(100, 4), results, MODELS)

    // Act
    const report = formatPerformanceReport({
      comparison,
      results,
      machine: MACHINE,
      baselineMachine: MACHINE,
      models: MODELS,
    })

    // Assert
    expect(report).toContain('| race | 110 (+10.0 %) **FAIL** | 1,000 (±0 %) |')
    expect(report).toContain('- race @ desktop: draw calls 100 → 110 (+10.0 %)')
    expect(report).toContain('Machine: Test CPU (8 cores, 16 GB)')
    expect(formatChange(-0.123)).toBe('-12.3 %')
  })
})

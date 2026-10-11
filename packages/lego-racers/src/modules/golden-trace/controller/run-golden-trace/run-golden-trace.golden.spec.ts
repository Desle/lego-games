import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes, loadRaceDefinition } from '../../../race/index.ts'
import { FpuPrecision } from '../../../simulation-math/index.ts'
import { getIsOriginalTraceAvailable } from '../../services/original-trace/original-trace.ts'
import type { GoldenTraceScenario, TraceFrameInput } from '../../types/golden-trace.types.ts'
import { getRouteDrivingFrames } from '../route-driving/route-driving.ts'
import {
  createTraceScenario,
  getIdleFrames,
  getSteeringSweepFrames,
  getWeavingFrames,
  holdBindings,
} from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 1_800_000
const ROYAL_KNIGHTS_RACEWAY = 'RACEC0R0'
// The introduction camera of Royal Knights Raceway ends after 7 ticks (the original's trace reports it).
const ROYAL_KNIGHTS_INTRODUCTION_CAMERA_LIMIT = 7
// The unported emitters of power-up objects and projectiles (oil slicks, cannon balls) draw from the random table in
// the original; the race of each is named in golden-trace.md.
const OTHER_TRACKS = [
  { folder: 'RACEC0R1', expected: { frame: 436, field: 'race.randomPosition' } },
  { folder: 'RACEC0R2', expected: { frame: 220, field: 'race.randomPosition' } },
  { folder: 'RACEC0R3', expected: null },
  { folder: 'RACEC1R0', expected: { frame: 417, field: 'race.randomPosition' } },
  { folder: 'RACEC3R0', expected: { frame: 278, field: 'race.randomPosition' } },
] as const
const RANDOM_CURSOR = 'race.randomPosition'

// Where the port first leaves the original in any compared field, or null for a match.
type ExpectedDivergence = { readonly frame: number; readonly field: string } | null

type ScenarioCase = {
  readonly scenario: GoldenTraceScenario
  readonly expected: ExpectedDivergence
}

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

const getFrameTimes = (): readonly TraceFrameInput[] => {
  const times = [16, 33, 50, 100, 12, 41, 77]
  return getSteeringSweepFrames().map((frame, index) => ({
    ...frame,
    milliseconds: times[index % times.length] ?? 33,
  }))
}

const getCases = (): readonly ScenarioCase[] => {
  const jam = readOriginalJam()
  const archive = openJamArchive(jam)
  const getCodes = (folder: string): readonly string[] =>
    getCircuitRacerCodes(archive.readFile, folder)
  const royalKnights = (name: string, frames: readonly TraceFrameInput[]): GoldenTraceScenario =>
    createTraceScenario({
      name,
      raceFolder: ROYAL_KNIGHTS_RACEWAY,
      racerCodes: getCodes(ROYAL_KNIGHTS_RACEWAY),
      frames,
    })
  const drivingDefinition = loadRaceDefinition(jam, readOriginalExecutable(), {
    raceFolder: ROYAL_KNIGHTS_RACEWAY,
    racerCodes: getCodes(ROYAL_KNIGHTS_RACEWAY),
    localPlayerCount: 1,
    fpuPrecision: FpuPrecision.SINGLE,
    isPlayerChampionCar: true,
    musicTuneCount: 0,
    introductionCameraLimit: ROYAL_KNIGHTS_INTRODUCTION_CAMERA_LIMIT,
  })
  return [
    { scenario: royalKnights('royal-knights-idle', getIdleFrames(300)), expected: null },
    { scenario: royalKnights('royal-knights-steering', getSteeringSweepFrames()), expected: null },
    {
      scenario: royalKnights('royal-knights-weaving', getWeavingFrames(1200)),
      expected: { frame: 539, field: RANDOM_CURSOR },
    },
    {
      scenario: royalKnights('royal-knights-frame-times', getFrameTimes()),
      expected: { frame: 424, field: RANDOM_CURSOR },
    },
    {
      scenario: royalKnights('royal-knights-start-boost', [
        ...getIdleFrames(160),
        ...holdBindings(120, ['accelerate']),
      ]),
      expected: null,
    },
    {
      scenario: royalKnights('royal-knights-route-driving', [
        ...getRouteDrivingFrames(drivingDefinition, 3000),
      ]),
      expected: { frame: 539, field: RANDOM_CURSOR },
    },
    {
      scenario: createTraceScenario({
        name: 'royal-knights-double-precision',
        raceFolder: ROYAL_KNIGHTS_RACEWAY,
        racerCodes: getCodes(ROYAL_KNIGHTS_RACEWAY),
        frames: getSteeringSweepFrames(),
        precision: FpuPrecision.DOUBLE,
      }),
      // Computers only, in the double-precision mode the game never runs: one unit in the last place at the start.
      expected: { frame: 160, field: 'racer1.body.velocity' },
    },
    ...OTHER_TRACKS.map(({ folder, expected }) => ({
      scenario: createTraceScenario({
        name: folder.toLowerCase(),
        raceFolder: folder,
        racerCodes: getCodes(folder),
        frames: getSteeringSweepFrames(),
      }),
      expected,
    })),
  ]
}

describe('golden trace: the original race and the port, frame for frame', () => {
  it.skipIf(!getIsGamePresent())(
    'matches the original bit for bit in what the player holds, in every scenario',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const actual: Record<string, ExpectedDivergence> = {}
      const expected: Record<string, ExpectedDivergence> = {}
      const reports: string[] = []

      // Act
      for (const { scenario, expected: expectation } of getCases()) {
        const result = await runGoldenTrace(scenario, jam, executable)
        const first = result.comparison.firstDivergence
        actual[scenario.name] = first === null ? null : { frame: first.frame, field: first.field }
        expected[scenario.name] = expectation
        reports.push(
          `${scenario.name}: ${String(result.comparison.frameCount)} frames, control word 0x${result.controlWord.toString(16)}, frame times ${result.isFrameTimeKept ? 'kept' : 'CHANGED'}, ` +
            `${String(result.comparison.divergenceByField.length)} fields differ` +
            (first === null ? '' : `, first: ${formatDivergence(first)}`)
        )
      }

      // Assert
      expect(actual, reports.join('\n')).toEqual(expected)
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

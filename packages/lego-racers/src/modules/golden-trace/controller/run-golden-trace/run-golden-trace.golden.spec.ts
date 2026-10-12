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
// The unported emitters of power-up objects and projectiles (oil slicks, cannon balls) draw from the random table in
// the original; the race of each is named in golden-trace.md.
const OTHER_TRACKS = [
  { folder: 'RACEC0R1', expected: { frame: 436, field: 'powerUps.registry' } },
  { folder: 'RACEC0R2', expected: { frame: 278, field: 'racer0.body.forwardSpeed' } },
  { folder: 'RACEC0R3', expected: null },
  { folder: 'RACEC1R0', expected: null },
  { folder: 'RACEC3R0', expected: null },
] as const

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
  })
  return [
    { scenario: royalKnights('royal-knights-idle', getIdleFrames(300)), expected: null },
    { scenario: royalKnights('royal-knights-steering', getSteeringSweepFrames()), expected: null },
    {
      scenario: royalKnights('royal-knights-weaving', getWeavingFrames(1200)),
      expected: null,
    },
    {
      scenario: royalKnights('royal-knights-frame-times', getFrameTimes()),
      expected: null,
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
      expected: { frame: 1882, field: 'powerUps.registry' },
    },
    {
      scenario: createTraceScenario({
        name: 'royal-knights-double-precision',
        raceFolder: ROYAL_KNIGHTS_RACEWAY,
        racerCodes: getCodes(ROYAL_KNIGHTS_RACEWAY),
        frames: getSteeringSweepFrames(),
        precision: FpuPrecision.DOUBLE,
      }),
      // The double-precision mode the game never runs: the world animation modules (skeleton clips, material
      // animations) compute in the race's single precision whatever the race is given, so the introduction camera's
      // clip time differs from frame 4 on. Computers' bodies differ by one unit in the last place from frame 160.
      expected: { frame: 4, field: 'track.world.track.skeletons' },
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

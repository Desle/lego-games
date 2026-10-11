import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getCircuitRacerCodes } from '../../../race/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getIsOriginalTraceAvailable } from '../../services/original-trace/original-trace.ts'
import {
  createTraceScenario,
  getIdleFrames,
  getSteeringSweepFrames,
  getWeavingFrames,
} from '../trace-scenarios/trace-scenarios.ts'
import type { GoldenTraceScenario } from '../../types/golden-trace.types.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 900_000
const ROYAL_KNIGHTS_RACEWAY = 'RACEC0R0'

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

const getScenarios = (): readonly GoldenTraceScenario[] => {
  const archive = openJamArchive(readOriginalJam())
  const getCodes = (folder: string): readonly string[] =>
    getCircuitRacerCodes(archive.readFile, folder)
  return [
    createTraceScenario({
      name: 'royal-knights-idle',
      raceFolder: ROYAL_KNIGHTS_RACEWAY,
      racerCodes: getCodes(ROYAL_KNIGHTS_RACEWAY),
      frames: getIdleFrames(300),
    }),
    createTraceScenario({
      name: 'royal-knights-steering-sweep',
      raceFolder: ROYAL_KNIGHTS_RACEWAY,
      racerCodes: getCodes(ROYAL_KNIGHTS_RACEWAY),
      frames: getSteeringSweepFrames(),
    }),
    createTraceScenario({
      name: 'royal-knights-weaving-lap',
      raceFolder: ROYAL_KNIGHTS_RACEWAY,
      racerCodes: getCodes(ROYAL_KNIGHTS_RACEWAY),
      frames: getWeavingFrames(1800),
    }),
  ]
}

describe('golden trace: the original race and the port, frame for frame', () => {
  it.skipIf(!getIsGamePresent())(
    'matches the original bit for bit in every scenario',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const reports: string[] = []

      // Act
      for (const scenario of getScenarios()) {
        const result = await runGoldenTrace(scenario, jam, executable)
        const lines = [
          `${scenario.name}: ${String(result.comparison.frameCount)} frames, control word 0x${result.controlWord.toString(16)}, port ${result.precision}`,
          ...result.comparison.divergenceByField
            .slice(0, 12)
            .map((divergence) => `  ${formatDivergence(divergence)}`),
        ]
        reports.push(
          result.comparison.firstDivergence === null ? `${scenario.name}: match` : lines.join('\n')
        )
      }

      // Assert
      expect(reports.filter((report) => !report.endsWith(': match'))).toEqual([])
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

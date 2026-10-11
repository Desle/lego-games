import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes } from '../../../race/index.ts'
import { getIsOriginalTraceAvailable } from '../../services/original-trace/original-trace.ts'
import type { GoldenTraceScenario } from '../../types/golden-trace.types.ts'
import { holdBindings } from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 3_600_000
const DEMONSTRATION_FRAME_COUNT = Number(process.env['TRACK_TRACE_FRAMES'] ?? 600)
const SELECTED_RACES = (process.env['TRACK_TRACE_RACES'] ?? 'RACEC0R0').split(',')
const isMirroredRun = process.env['TRACK_TRACE_MIRRORED'] === '1'

const CIRCUIT_OF_RACE: Readonly<Record<string, string>> = {
  RACEC0R0: 'c1',
  RACEC1R1: 'c1',
  RACEC1R2: 'c1',
  RACEC1R3: 'c1',
  RACEC0R1: 'c0',
  RACEC0R2: 'c0',
  RACEC0R3: 'c0',
  RACEC1R0: 'c0',
  RACEC2R0: 'c2',
  RACEC2R1: 'c2',
  RACEC2R2: 'c2',
  RACEC2R3: 'c2',
  RACEC3R0: 'c6',
}

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

// Every racer is a computer (a demonstration race), so the whole race runs without input.
const getScenario = (raceFolder: string): GoldenTraceScenario => {
  const archive = openJamArchive(readOriginalJam())
  const racerCodes = getCircuitRacerCodes(archive.readFile, raceFolder)
  return {
    name: `${raceFolder.toLowerCase()}${isMirroredRun ? '-mirrored' : ''}`,
    raceFolder,
    racerCodes,
    racerCount: Math.min(6, racerCodes.length),
    localPlayerCount: 0,
    randomPosition: 0,
    isMirrored: isMirroredRun,
    circuit: CIRCUIT_OF_RACE[raceFolder] ?? 'c1',
    precision: 'auto',
    frames: holdBindings(DEMONSTRATION_FRAME_COUNT, []),
  }
}

describe('track logic and race flow: the original race and the port, frame for frame', () => {
  it.skipIf(!getIsGamePresent())(
    'reports the first difference of every track logic field',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const reports: string[] = []

      // Act
      for (const raceFolder of SELECTED_RACES) {
        const result = await runGoldenTrace(getScenario(raceFolder), jam, executable)
        reports.push(
          `${raceFolder}: ${String(result.comparison.frameCount)} frames`,
          ...result.comparison.divergenceByField
            .filter((divergence) => !divergence.field.includes('.body.'))
            .map((divergence) => `  ${formatDivergence(divergence)}`)
        )
      }

      // Assert
      console.log(reports.join('\n'))
      expect(reports.length).toBeGreaterThan(0)
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

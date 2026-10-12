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
import { getLapDrivingFrames } from '../route-driving/lap-driving.ts'
import { createTraceScenario } from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 1_800_000
const ROYAL_KNIGHTS_RACEWAY = 'RACEC0R0'
// The player drives the lap backwards (the start line is 175 frames in, the hammer's trigger is reached about 400
// frames later) and meets the swinging hammer, which only starts for a human racer, near frame 640.
const DRIVING_FRAME_COUNT = 560

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

describe('golden trace: a car drives into the Royal Knights hammer', () => {
  it.skipIf(!getIsGamePresent())(
    'matches the original bit for bit while the hammer body pushes the player',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const racerCodes = getCircuitRacerCodes(openJamArchive(jam).readFile, ROYAL_KNIGHTS_RACEWAY)
      const definition = loadRaceDefinition(jam, executable, {
        raceFolder: ROYAL_KNIGHTS_RACEWAY,
        racerCodes,
        localPlayerCount: 1,
        fpuPrecision: FpuPrecision.SINGLE,
        isPlayerChampionCar: true,
        musicTuneCount: 0,
      })
      const scenario = createTraceScenario({
        name: 'royal-knights-hammer',
        raceFolder: ROYAL_KNIGHTS_RACEWAY,
        racerCodes,
        frames: getLapDrivingFrames(definition, DRIVING_FRAME_COUNT, true),
      })

      // Act
      const result = await runGoldenTrace(scenario, jam, executable)

      // Assert
      const first = result.comparison.firstDivergence
      expect(
        first === null ? null : formatDivergence(first),
        result.comparison.divergenceByField
          .slice(0, 40)
          .map((divergence) => formatDivergence(divergence))
          .join('\n')
      ).toBeNull()
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

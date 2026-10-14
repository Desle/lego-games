import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes } from '../../../race/index.ts'
import { getIsOriginalTraceAvailable } from '../../services/original-trace/original-trace.ts'
import { createTraceScenario, getIdleFrames } from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 1_800_000
const ROYAL_KNIGHTS_RACEWAY = 'RACEC0R0'
// The racing state starts near frame 160; three racers are done with their laps a little later (the player second),
// then the finishing state runs 10 s (the race's table from 5 s) and the results 5 s (the totals) until the loop ends.
const FRAME_COUNT = 800
export const POINTS_TABLE_FINISHES = Object.freeze([
  { frame: 300, racer: 3, lapMilliseconds: [30_120, 31_480, 29_900] },
  { frame: 300, racer: 0, lapMilliseconds: [31_000, 30_520, 32_440] },
  { frame: 330, racer: 5, lapMilliseconds: [29_000, 28_250, 27_010] },
])
// The circuit's totals before this race (a later race of the circuit).
export const POINTS_TABLE_TOTALS = Object.freeze([40, 25, 33, 10, 5, 7])
// The flow, the places and the points record (+0x10..+0x43): what the table is drawn from and when.
const COMPARED_FIELD_PATTERN =
  /^race\.(phase|phaseMilliseconds|pointsRecord|finishedCount|isRunning|placements)$|\.racer\.(position|flags)$/

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

describe('golden trace: the points table of a circuit race', () => {
  it.skipIf(!getIsGamePresent())(
    'places, scores and counts down the table like the original until the loop ends',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const scenario = createTraceScenario({
        name: 'points-table',
        raceFolder: ROYAL_KNIGHTS_RACEWAY,
        racerCodes: getCircuitRacerCodes(openJamArchive(jam).readFile, ROYAL_KNIGHTS_RACEWAY),
        frames: getIdleFrames(FRAME_COUNT),
        racerFinishes: POINTS_TABLE_FINISHES,
        pointsRecordTotals: POINTS_TABLE_TOTALS,
      })

      // Act
      const result = await runGoldenTrace(scenario, jam, executable)
      const divergences = result.comparison.divergenceByField.filter((divergence) =>
        COMPARED_FIELD_PATTERN.test(divergence.field)
      )

      // Assert
      // The results state ended the loop (after 756 frames) in both.
      expect(result.comparison.frameCount).toBeLessThan(FRAME_COUNT)
      expect(divergences.map((divergence) => formatDivergence(divergence))).toEqual([])
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

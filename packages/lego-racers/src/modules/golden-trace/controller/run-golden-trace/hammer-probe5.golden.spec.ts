import { writeFileSync } from 'node:fs'
import {
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes, loadRaceDefinition } from '../../../race/index.ts'
import { FpuPrecision } from '../../../simulation-math/index.ts'
import { getLapDrivingFrames } from '../route-driving/lap-driving.ts'
import { createTraceScenario } from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

describe('probe', () => {
  it('searches', async () => {
    const jam = readOriginalJam()
    const executable = readOriginalExecutable()
    const racerCodes = getCircuitRacerCodes(openJamArchive(jam).readFile, 'RACEC0R0')
    const definition = loadRaceDefinition(jam, executable, {
      raceFolder: 'RACEC0R0',
      racerCodes,
      localPlayerCount: 1,
      fpuPrecision: FpuPrecision.SINGLE,
      isPlayerChampionCar: true,
      musicTuneCount: 0,
    })
    const lines: string[] = []
    for (const aim of [20, 24, 28, 32, 36, 42, 46, 50, 54, 58, 62, 66, 70, 80]) {
      const scenario = createTraceScenario({
        name: `royal-knights-hammer-aim-${String(aim)}`,
        raceFolder: 'RACEC0R0',
        racerCodes,
        frames: getLapDrivingFrames(definition, 600, true, aim),
      })
      const result = await runGoldenTrace(scenario, jam, executable)
      const first = result.comparison.firstDivergence
      lines.push(
        `aim=${String(aim)} ${first === null ? 'match' : formatDivergence(first)} fields=${String(result.comparison.divergenceByField.length)}`
      )
      writeFileSync(
        '/private/tmp/claude-501/-Users-desle-Vibespace-projects-lego-games/baee6b02-5a40-431c-a08d-c5cbd67b862e/scratchpad/probe.txt',
        lines.join('\n')
      )
    }
  }, 3600000)
})

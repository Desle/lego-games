import { writeFileSync } from 'node:fs'
import {
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getCircuitRacerCodes } from '../../../race/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import {
  createTraceScenario,
  getIdleFrames,
  getSteeringSweepFrames,
} from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

describe('debug', () => {
  it('prints divergences', async () => {
    const archive = openJamArchive(readOriginalJam())
    const codes = getCircuitRacerCodes(archive.readFile, 'RACEC0R0')
    const kind = globalThis.process.argv.includes('--sweep') ? 'sweep' : 'idle'
    const scenario = createTraceScenario({
      name: 'debug',
      raceFolder: 'RACEC0R0',
      racerCodes: codes,
      frames: kind === 'sweep' ? getSteeringSweepFrames() : getIdleFrames(300),
    })
    const result = await runGoldenTrace(scenario, readOriginalJam(), readOriginalExecutable())
    writeFileSync(
      '/private/tmp/claude-501/-Users-desle-Vibespace-projects-lego-games/baee6b02-5a40-431c-a08d-c5cbd67b862e/scratchpad/divergences.txt',
      result.comparison.divergenceByField.map(formatDivergence).join('\n') + '\n'
    )
  }, 900_000)
})

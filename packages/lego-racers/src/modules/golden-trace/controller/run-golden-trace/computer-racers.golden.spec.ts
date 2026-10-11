import { writeFileSync } from 'node:fs'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseCircuitDatabase } from '../../../circuit-database/index.ts'
import { parseRaceCatalog } from '../../../race-catalog/index.ts'
import { getIsOriginalTraceAvailable } from '../../services/original-trace/original-trace.ts'
import type { TraceFrameInput } from '../../types/golden-trace.types.ts'
import {
  createTraceScenario,
  getIdleFrames,
  getWeavingFrames,
} from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 3_600_000
const REPORT_PATH = process.env['COMPUTER_REPORT'] ?? ''
const FRAME_COUNT = Number(process.env['COMPUTER_FRAMES'] ?? '700')
const SELECTED = process.env['COMPUTER_RACES'] ?? ''
const KIND = process.env['COMPUTER_KIND'] ?? 'idle'

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

const getFrames = (): readonly TraceFrameInput[] =>
  KIND === 'weave' ? getWeavingFrames(FRAME_COUNT - 175) : getIdleFrames(FRAME_COUNT)

describe('golden trace: the computer racers', () => {
  it.skipIf(!getIsGamePresent())(
    'reports the computer racers divergences',
    async () => {
      const jam = readOriginalJam()
      const archive = openJamArchive(jam)
      const circuits = parseCircuitDatabase(archive.readFile('MENUDATA\\LEGORACE.CRB'))
      const catalog = parseRaceCatalog(archive.readFile('MENUDATA\\LEGORACE.RCB'), circuits)
      const lines: string[] = []
      for (const entry of catalog.entries) {
        if (entry.name === 'test') continue
        if (SELECTED !== '' && !SELECTED.split(',').includes(entry.name)) continue
        const circuit = circuits.circuits.find((candidate) => candidate.name === entry.circuitName)
        const racerCodes = circuit?.racerCodes ?? []
        const scenario = createTraceScenario({
          name: `${entry.name}-${KIND}`,
          raceFolder: entry.firstName.toUpperCase(),
          racerCodes,
          frames: getFrames(),
          circuitName: entry.circuitName,
          isMirrored: entry.isFlagged,
        })
        const result = await runGoldenTrace(scenario, jam, readOriginalExecutable())
        const computers = result.comparison.divergenceByField
          .filter((divergence) => /^racer[1-9]\./u.test(divergence.field))
          .sort((left, right) => left.frame - right.frame)
          .slice(0, 10)
        lines.push(
          `${scenario.name} (${entry.firstName} ${entry.circuitName} mirrored ${String(entry.isFlagged)}): ${String(result.comparison.divergenceByField.length)} fields differ` +
            computers.map((divergence) => `\n    ${formatDivergence(divergence)}`).join('')
        )
        if (REPORT_PATH !== '') writeFileSync(REPORT_PATH, lines.join('\n'))
      }
      console.log(lines.join('\n'))
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

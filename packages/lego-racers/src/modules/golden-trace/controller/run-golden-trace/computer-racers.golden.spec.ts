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

// The first field that differs, per race, in a run of every race (races that match are left out).
const EXPECTED_FIRST_FIELDS: Readonly<Record<string, Readonly<Record<string, string | null>>>> =
  Object.freeze({
    idle: Object.freeze({}),
    // The weaving player for 7,000 frames; what is open is listed in golden-trace-simulation-sweep.md.
    'weave-7000': Object.freeze({
      aar: 'race.randomPosition[0]',
      att: 'track.hammers[73]',
      att2: 'track.hammers[73]',
      frk: 'powerUps.effects[0]',
      frk2: 'powerUps.effects[0]',
      igp: 'racer3.body.flags[0]',
      mmm: 'emitters.track.instances[6]',
      mmm2: 'emitters.track.instances[6]',
      rkr2: 'racer2.racer.curseFigure[0]',
      rr: 'powerUps.effects[10]',
    }),
  })

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
      const firstFields: Record<string, string | null> = {}
      for (const entry of catalog.entries) {
        if (entry.name === 'test') continue
        if (SELECTED !== '' && !SELECTED.split(',').includes(entry.name)) continue
        const circuit = circuits.circuits.find((candidate) => candidate.name === entry.circuitName)
        const sibling = catalog.entries.find(
          (candidate) => candidate.firstName === entry.firstName && candidate.circuitName !== ''
        )
        const racerCodes =
          circuit?.racerCodes ??
          circuits.circuits.find((candidate) => candidate.name === sibling?.circuitName)
            ?.racerCodes ??
          []
        const scenario = createTraceScenario({
          name: `${entry.name}-${KIND}`,
          raceFolder: entry.firstName.toUpperCase(),
          racerCodes,
          frames: getFrames(),
          circuitName: entry.circuitName,
          isMirrored: entry.isFlagged,
        })
        if (process.env['COMPUTER_DUMP'] !== undefined)
          writeFileSync(
            `${process.env['COMPUTER_DUMP']}/${entry.name}.json`,
            JSON.stringify({
              raceFolder: scenario.raceFolder,
              racerCodes: scenario.racerCodes,
              racerCount: scenario.racerCount,
              localPlayerCount: 1,
              randomPosition: 0,
              circuit: scenario.circuitName,
              isMirrored: scenario.isMirrored,
              fpu: 'auto',
              frames: scenario.frames.map((frame) => ({
                dt: frame.milliseconds,
                keys: frame.scanCodes,
              })),
            })
          )
        if (process.env['COMPUTER_DUMP_ONLY'] !== undefined) continue
        const result = await runGoldenTrace(scenario, jam, readOriginalExecutable())
        const computers = result.comparison.divergenceByField
          .toSorted((left, right) => left.frame - right.frame)
          .slice(0, 10)
        const [first] = computers
        firstFields[entry.name] =
          first === undefined ? null : `${first.field}[${String(first.wordIndex)}]`
        lines.push(
          `${scenario.name} (${entry.firstName} ${entry.circuitName} mirrored ${String(entry.isFlagged)}): ${String(result.comparison.divergenceByField.length)} fields differ` +
            computers.map((divergence) => `\n    ${formatDivergence(divergence)}`).join('')
        )
        if (REPORT_PATH !== '') writeFileSync(REPORT_PATH, lines.join('\n'))
      }
      console.log(lines.join('\n'))
      const expected =
        EXPECTED_FIRST_FIELDS[KIND === 'weave' ? `weave-${String(FRAME_COUNT)}` : KIND]
      if (
        SELECTED === '' &&
        expected !== undefined &&
        process.env['COMPUTER_DUMP_ONLY'] === undefined
      ) {
        expect(
          Object.fromEntries(Object.entries(firstFields).filter(([, field]) => field !== null)),
          lines.join('\n')
        ).toEqual(expected)
      }
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

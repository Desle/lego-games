import { writeFileSync } from 'node:fs'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes } from '../../../race/index.ts'
import { getIsOriginalTraceAvailable } from '../../services/original-trace/original-trace.ts'
import type { PowerUpGrant, TraceFrameInput } from '../../types/golden-trace.types.ts'
import { createTraceScenario, holdBindings } from '../trace-scenarios/trace-scenarios.ts'
import { formatDivergence, runGoldenTrace } from './run-golden-trace.ts'

const TRACE_TIMEOUT_MILLISECONDS = 3_600_000
const REPORT_PATH = process.env['POWER_UP_REPORT'] ?? ''
const RACE_FOLDER = process.env['POWER_UP_RACE'] ?? 'RACEC0R0'
const CIRCUIT_NAME = process.env['POWER_UP_CIRCUIT'] ?? 'c1'
const AFTER_START_FRAMES = Number(process.env['POWER_UP_FRAMES'] ?? '400')
const KINDS = (process.env['POWER_UP_KINDS'] ?? '1,2,3,4').split(',').map(Number)
const LEVELS = (process.env['POWER_UP_LEVELS'] ?? '0,1,2,3').split(',').map(Number)
const isComputerGranted = process.env['POWER_UP_COMPUTERS'] === '1'
const RACER_COUNT = 6
// The racers are released at frame 160; the grant comes just after and the use key is pressed for three frames.
const GRANT_FRAME = Number(process.env['POWER_UP_GRANT_FRAME'] ?? '162')
const USE_FRAME = Number(process.env['POWER_UP_USE_FRAME'] ?? '165')
const USE_FRAME_COUNT = 3
const REPORTED_FIELD_COUNT = Number(process.env['POWER_UP_REPORT_FIELDS'] ?? '14')

const getScanCodes = (bindings: readonly ('accelerate' | 'use_power_up')[]): readonly number[] =>
  holdBindings(1, bindings)[0]?.scanCodes ?? []

const getIsGamePresent = (): boolean =>
  getIsOriginalJamPresent() && getIsOriginalExecutablePresent() && getIsOriginalTraceAvailable()

// The player accelerates from ACCELERATE_FRAME (the use frame unless POWER_UP_ACCELERATE_FRAME says otherwise) and
// presses the use key for three frames.
const ACCELERATE_FRAME = Number(process.env['POWER_UP_ACCELERATE_FRAME'] ?? String(USE_FRAME))
const getFrames = (): readonly TraceFrameInput[] =>
  Array.from({ length: AFTER_START_FRAMES + 160 }, (_, frame) => ({
    milliseconds: 33,
    scanCodes: [
      ...(frame >= ACCELERATE_FRAME ? getScanCodes(['accelerate']) : []),
      ...(frame >= USE_FRAME && frame < USE_FRAME + USE_FRAME_COUNT
        ? getScanCodes(['use_power_up'])
        : []),
    ],
  }))

// POWER_UP_RACERS names the racers that get the brick (comma separated); otherwise only the player, or all of them with
// POWER_UP_COMPUTERS=1.
const grantedRacers = (process.env['POWER_UP_RACERS'] ?? '')
  .split(',')
  .filter((racer) => racer !== '')
  .map(Number)
const getGrants = (kind: number, level: number): readonly PowerUpGrant[] =>
  (grantedRacers.length > 0
    ? grantedRacers
    : Array.from({ length: isComputerGranted ? RACER_COUNT : 1 }, (_, racer) => racer)
  ).map((racer) => ({
    frame: GRANT_FRAME,
    racer,
    kind,
    level,
  }))

describe('golden trace: power-ups', () => {
  it.skipIf(!getIsGamePresent())(
    'reports where the power-ups diverge',
    async () => {
      const jam = readOriginalJam()
      const archive = openJamArchive(jam)
      const racerCodes = getCircuitRacerCodes(archive.readFile, RACE_FOLDER)
      const lines: string[] = []
      for (const kind of KINDS) {
        for (const level of LEVELS) {
          const scenario = createTraceScenario({
            name: `${RACE_FOLDER}-kind${String(kind)}-level${String(level)}`,
            raceFolder: RACE_FOLDER,
            racerCodes,
            circuitName: CIRCUIT_NAME,
            frames: getFrames(),
            powerUpGrants: getGrants(kind, level),
          })
          if (process.env['POWER_UP_DUMP'] !== undefined) {
            writeFileSync(
              `${process.env['POWER_UP_DUMP']}/${scenario.name}.json`,
              JSON.stringify({
                raceFolder: scenario.raceFolder,
                racerCodes: scenario.racerCodes,
                racerCount: scenario.racerCount,
                localPlayerCount: 1,
                randomPosition: 0,
                circuit: scenario.circuitName,
                isMirrored: scenario.isMirrored,
                fpu: 'auto',
                powerUpGrants: scenario.powerUpGrants,
                frames: scenario.frames.map((frame) => ({
                  dt: frame.milliseconds,
                  keys: frame.scanCodes,
                })),
              })
            )
            continue
          }
          const result = await runGoldenTrace(scenario, jam, readOriginalExecutable())
          const fields = [...result.comparison.divergenceByField].sort(
            (left, right) => left.frame - right.frame
          )
          lines.push(
            `${scenario.name}: ${String(fields.length)} fields differ` +
              fields
                .slice(0, REPORTED_FIELD_COUNT)
                .map((divergence) => `\n    ${formatDivergence(divergence)}`)
                .join('')
          )
          if (REPORT_PATH !== '') writeFileSync(REPORT_PATH, lines.join('\n'))
        }
      }
      console.log(lines.join('\n'))
    },
    TRACE_TIMEOUT_MILLISECONDS
  )
})

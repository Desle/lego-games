import { readFileSync, writeFileSync } from 'node:fs'
import {
  readOriginalJam,
  readOriginalExecutable,
} from '../../../../shared/testing/original-files.ts'
import { loadRaceDefinition } from '../../../race/index.ts'
import { FpuPrecision } from '../../../simulation-math/index.ts'
import { readOriginalTrace } from '../../services/original-trace/original-trace.ts'
import type { GoldenTraceScenario } from '../../types/golden-trace.types.ts'
import { getPortTrace } from '../port-trace/port-trace.ts'

const SCENARIO_PATH = process.env['DEBUG_SCENARIO'] ?? ''
const FIELDS = (process.env['DEBUG_FIELDS'] ?? '').split(',')
const FIRST = Number(process.env['DEBUG_FIRST'] ?? '0')
const LAST = Number(process.env['DEBUG_LAST'] ?? '0')
const OUTPUT = process.env['DEBUG_OUTPUT'] ?? ''

const hex = (words: readonly number[] | undefined): string =>
  (words ?? []).map((word) => (word >>> 0).toString(16).padStart(8, '0')).join(' ')

describe('golden trace debug', () => {
  it.skipIf(SCENARIO_PATH === '')(
    'prints fields',
    async () => {
      const raw = JSON.parse(readFileSync(SCENARIO_PATH, 'utf8')) as {
        raceFolder: string
        racerCodes: string[]
        racerCount: number
        circuit: string
        isMirrored: boolean
        frames: { dt: number; keys: number[] }[]
      }
      const scenario: GoldenTraceScenario = {
        name: 'debug',
        raceFolder: raw.raceFolder,
        racerCodes: raw.racerCodes,
        racerCount: raw.racerCount,
        localPlayerCount: 1,
        randomPosition: 0,
        circuitName: raw.circuit,
        isMirrored: raw.isMirrored,
        precision: 'auto',
        frames: raw.frames.map((frame) => ({ milliseconds: frame.dt, scanCodes: frame.keys })),
      }
      const original = await readOriginalTrace(scenario)
      const definition = loadRaceDefinition(readOriginalJam(), readOriginalExecutable(), {
        raceFolder: scenario.raceFolder,
        racerCodes: scenario.racerCodes,
        racerCount: scenario.racerCount,
        localPlayerCount: 1,
        randomPosition: 0,
        isMirrored: scenario.isMirrored,
        fpuPrecision: FpuPrecision.SINGLE,
        isPlayerChampionCar: true,
        musicTuneCount: 0,
        introductionCameraLimit:
          original.introductionCameraLimit < 0 ? null : original.introductionCameraLimit,
        introductionCameraRate: original.introductionCameraRate,
      })
      const port = getPortTrace(scenario, definition)
      const lines: string[] = []
      for (let frame = FIRST; frame <= LAST; frame += 1) {
        for (const field of FIELDS) {
          const left = hex(original.frames[frame]?.fields[field])
          const right = hex(port[frame]?.fields[field])
          lines.push(
            `${String(frame)} ${field}\n  o ${left}\n  p ${right}${left === right ? '' : '   <<<'}`
          )
        }
      }
      writeFileSync(OUTPUT, lines.join('\n'))
    },
    3_600_000
  )
})

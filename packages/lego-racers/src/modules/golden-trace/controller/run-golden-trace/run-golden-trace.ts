import { FpuPrecision } from '../../../simulation-math/index.ts'
import type { FpuPrecisionValue } from '../../../simulation-math/index.ts'
import { loadRaceDefinition } from '../../../race/index.ts'
import { readOriginalTrace } from '../../services/original-trace/original-trace.ts'
import type {
  FieldDivergence,
  GoldenTraceScenario,
  TraceComparison,
} from '../../types/golden-trace.types.ts'
import { compareTraces } from '../compare-traces/compare-traces.ts'
import { getPortTrace } from '../port-trace/port-trace.ts'

// x87 control word bits 8 and 9: 0 is a 24-bit significand, 2 is 53 bits.
const PRECISION_CONTROL_MASK = 0x300

// Causes before effects: the input, the controller, the driver, the body, then what the body drives.
const FIELD_GROUP_ORDER = ['race.', 'player', '.driver.', '.racer.', '.body.', '.display.']

const getFieldOrder = (field: string): number => {
  const group = FIELD_GROUP_ORDER.findIndex((marker) => field.includes(marker))
  return group === -1 ? FIELD_GROUP_ORDER.length : group
}

export type GoldenTraceResult = {
  readonly comparison: TraceComparison
  readonly controlWord: number
  readonly precision: FpuPrecisionValue
  readonly isFrameTimeKept: boolean
}

// Runs the original race in the emulator and the port with the same frames, and compares them bit for bit.
export const runGoldenTrace = async (
  scenario: GoldenTraceScenario,
  jam: Uint8Array,
  executable: Uint8Array
): Promise<GoldenTraceResult> => {
  const original = await readOriginalTrace(scenario)
  const precision =
    scenario.precision === 'auto'
      ? (original.controlWord & PRECISION_CONTROL_MASK) === 0
        ? FpuPrecision.SINGLE
        : FpuPrecision.DOUBLE
      : scenario.precision
  const definition = loadRaceDefinition(jam, executable, {
    raceFolder: scenario.raceFolder,
    racerCodes: scenario.racerCodes,
    racerCount: scenario.racerCount,
    localPlayerCount: scenario.localPlayerCount,
    randomPosition: scenario.randomPosition,
    fpuPrecision: precision,
    isPlayerChampionCar: true,
  })
  const port = getPortTrace(scenario, definition)
  const first = original.frames[0]
  const fieldNames = Object.keys(first?.fields ?? {}).sort(
    (left, right) => getFieldOrder(left) - getFieldOrder(right)
  )
  return {
    comparison: compareTraces(original.frames, port, fieldNames),
    controlWord: original.controlWord,
    precision,
    isFrameTimeKept: original.frames.every(
      (frame, index) => frame.milliseconds === scenario.frames[index]?.milliseconds
    ),
  }
}

export const formatDivergence = (divergence: FieldDivergence): string =>
  `frame ${String(divergence.frame)} ${divergence.field}[${String(divergence.wordIndex)}]: original ` +
  `0x${divergence.originalBits.toString(16).padStart(8, '0')} port ` +
  `0x${divergence.portBits.toString(16).padStart(8, '0')}`

import type { RaceState } from '../../race/index.ts'
import type { FpuPrecisionValue } from '../../simulation-math/index.ts'

// One frame of a scenario: the frame time the clock hands the game and the DirectInput scan codes held during it.
export type TraceFrameInput = {
  readonly milliseconds: number
  readonly scanCodes: readonly number[]
}

// A racer is handed a power-up brick of this kind (1 to 4: projectile, shield, turbo, hazard) at this enhancement level
// (0 to 3) just before the frame runs, in the original (racer +0xccc and +0xd58) and in the port alike.
export type PowerUpGrant = {
  readonly frame: number
  readonly racer: number
  readonly kind: number
  readonly level: number
}

export type GoldenTraceScenario = {
  readonly name: string
  readonly raceFolder: string
  // The driver code of every racer slot; the local players take the first slots with their champion car.
  readonly racerCodes: readonly string[]
  readonly racerCount: number
  readonly localPlayerCount: number
  readonly randomPosition: number
  // The circuit's name in LEGORACE.CRB (game settings +0x2d) and the mirrored second pass's flag (+0x3c).
  readonly circuitName: string
  readonly isMirrored: boolean
  // 'auto' lets the original's DDSCL_FPUSETUP choose (24-bit); the port then runs single precision.
  readonly precision: FpuPrecisionValue | 'auto'
  readonly frames: readonly TraceFrameInput[]
  readonly powerUpGrants: readonly PowerUpGrant[]
}

// The 32-bit words of every observed field, by name: floats as their IEEE bits.
export type TraceFields = Readonly<Record<string, readonly number[]>>

// Reads one group of compared fields from the port's race state (see TRACE_FIELD_PROVIDERS).
export type TraceFieldProvider = (raceState: RaceState, localPlayerCount: number) => TraceFields

export type TraceFrame = {
  readonly frame: number
  readonly milliseconds: number
  readonly fields: TraceFields
}

export type OriginalTrace = {
  readonly frames: readonly TraceFrame[]
  // The x87 control word after the last frame.
  readonly controlWord: number
  // The introduction camera animation's length minus one, or -1 without one.
  readonly introductionCameraLimit: number
  // The camera animation's clock rate in ticks per millisecond (skeleton instance +0xb8).
  readonly introductionCameraRate: number
}

export type FieldDivergence = {
  readonly frame: number
  readonly field: string
  readonly wordIndex: number
  readonly originalBits: number
  readonly portBits: number
  // How many frames the field differs in, from this one on.
  readonly differingFrameCount: number
}

export type TraceComparison = {
  readonly frameCount: number
  // The first difference in frame order, then field order; null when the traces match bit for bit.
  readonly firstDivergence: FieldDivergence | null
  // The first frame each differing field differs in, ordered by frame.
  readonly divergenceByField: readonly FieldDivergence[]
}

export type GoldenTraceResult = {
  readonly comparison: TraceComparison
  readonly controlWord: number
  readonly precision: FpuPrecisionValue
  readonly isFrameTimeKept: boolean
}

export type ScenarioRequest = {
  readonly name: string
  readonly raceFolder: string
  readonly racerCodes: readonly string[]
  readonly frames: readonly TraceFrameInput[]
  readonly precision?: GoldenTraceScenario['precision']
  readonly circuitName?: string
  readonly isMirrored?: boolean
  readonly racerCount?: number
  readonly powerUpGrants?: readonly PowerUpGrant[]
}

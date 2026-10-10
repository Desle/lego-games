import type {
  EmulatorBufferReference,
  EmulatorConvention,
  EmulatorPrecision,
} from './emulator-client.types.ts'
import type { FloatSampler } from './seeded-random.types.ts'

// Floats of the case's input array copied into a struct at a byte offset.
export type StructField = {
  readonly byteOffset: number
  readonly start: number
  readonly count: number
}

// A uint32 stored in a struct: a constant such as a vtable address, or the address of another buffer.
export type StructPointer = {
  readonly byteOffset: number
  readonly target: number | EmulatorBufferReference
}

export type StructOutput = {
  readonly byteOffset: number
  readonly floatCount: number
}

// An object laid out like the original's: inputs at offsets, pointers, and the regions read back as outputs.
export type StructSlot = {
  readonly kind: 'struct'
  readonly name: string
  readonly byteSize: number
  readonly isArgument: boolean
  readonly fields: readonly StructField[]
  readonly pointers: readonly StructPointer[]
  readonly outputs: readonly StructOutput[]
}

// One argument of the original function. `floats` and `float` read the case's flat input array.
export type ArgumentSlot =
  | {
      readonly kind: 'floats'
      readonly name: string
      readonly start: number
      readonly count: number
      readonly isRead: boolean
    }
  | { readonly kind: 'float'; readonly index: number }
  // Passed as an unsigned integer (the original converts it with FILD).
  | { readonly kind: 'integerInput'; readonly index: number }
  // A second pointer to a buffer another slot defines.
  | { readonly kind: 'reference'; readonly name: string }
  // `skipFloats` leading floats of the buffer are not part of the output (a struct whose result starts at a later offset).
  | {
      readonly kind: 'output'
      readonly name: string
      readonly floatCount: number
      readonly skipFloats?: number
    }
  | { readonly kind: 'integer'; readonly value: number }
  | StructSlot

// A float32-only function: inputs and outputs are flat arrays of float32 values.
export type DifferentialDefinition = {
  readonly name: string
  readonly address: number
  readonly convention: EmulatorConvention
  readonly slots: readonly ArgumentSlot[]
  // Outputs come from the `output`, `struct` and `isRead` `floats` slots, in slot order.
  readonly runPort: (precision: EmulatorPrecision, input: readonly number[]) => readonly number[]
}

export type DifferentialSuite = {
  readonly definition: DifferentialDefinition
  readonly generateInput: (sampler: FloatSampler) => readonly number[]
  // Hand-picked cases run before the generated ones.
  readonly fixedInputs?: readonly (readonly number[])[]
  readonly caseCount?: number
}

export type DifferentialMismatch = {
  readonly functionName: string
  readonly precision: EmulatorPrecision
  readonly input: readonly number[]
  readonly originalBits: readonly number[]
  readonly portBits: readonly number[]
}

export type DifferentialReport = {
  readonly functionName: string
  readonly precision: EmulatorPrecision
  readonly caseCount: number
  readonly mismatchCount: number
  // Cases that differ, per position in the flat output.
  readonly outputMismatchCounts: readonly number[]
  readonly mismatches: readonly DifferentialMismatch[]
}

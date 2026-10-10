import { formatBits, getBitsFromFloat, getIsSameFloatBits } from './float-bits.ts'
import type {
  EmulatorArgument,
  EmulatorBuffer,
  EmulatorCall,
  EmulatorCallResult,
  EmulatorPrecision,
  EmulatorSession,
} from './emulator-client.types.ts'
import type {
  ArgumentSlot,
  DifferentialDefinition,
  DifferentialMismatch,
  DifferentialReport,
  StructSlot,
} from './differential.types.ts'

const MAXIMUM_CALLS_PER_BATCH = 500
const MAXIMUM_REPORTED_MISMATCHES = 5
const BYTES_PER_WORD = 4

const getStructWords = (
  slot: StructSlot,
  input: readonly number[]
): readonly EmulatorArgument[] => {
  const words: EmulatorArgument[] = Array.from({ length: slot.byteSize / BYTES_PER_WORD }, () => 0)
  for (const field of slot.fields) {
    for (let index = 0; index < field.count; index += 1) {
      words[field.byteOffset / BYTES_PER_WORD + index] = getBitsFromFloat(
        input[field.start + index] ?? 0
      )
    }
  }
  for (const pointer of slot.pointers) words[pointer.byteOffset / BYTES_PER_WORD] = pointer.target
  return words
}

const getBufferForSlot = (slot: ArgumentSlot, input: readonly number[]): EmulatorBuffer | null => {
  if (slot.kind === 'floats') {
    const floats = input.slice(slot.start, slot.start + slot.count)
    return { name: slot.name, words: floats.map(getBitsFromFloat), isRead: slot.isRead }
  }
  if (slot.kind === 'output') {
    const size = ((slot.skipFloats ?? 0) + slot.floatCount) * BYTES_PER_WORD
    return { name: slot.name, size, isRead: true }
  }
  if (slot.kind === 'struct') {
    return { name: slot.name, words: getStructWords(slot, input), isRead: slot.outputs.length > 0 }
  }
  return null
}

const getArgumentsForSlot = (
  slot: ArgumentSlot,
  input: readonly number[]
): readonly EmulatorArgument[] => {
  if (slot.kind === 'float') return [getBitsFromFloat(input[slot.index] ?? 0)]
  if (slot.kind === 'integerInput') return [Math.trunc(input[slot.index] ?? 0)]
  if (slot.kind === 'integer') return [slot.value]
  if (slot.kind === 'struct' && !slot.isArgument) return []
  return [{ buffer: slot.name }]
}

const getOutputBits = (
  slots: readonly ArgumentSlot[],
  result: EmulatorCallResult | undefined
): readonly number[] =>
  slots.flatMap((slot) => {
    if (slot.kind === 'output') {
      return (result?.buffers[slot.name] ?? []).slice(slot.skipFloats ?? 0)
    }
    if (slot.kind === 'floats') return slot.isRead ? (result?.buffers[slot.name] ?? []) : []
    if (slot.kind !== 'struct') return []
    const words = result?.buffers[slot.name] ?? []
    return slot.outputs.flatMap((output) => {
      const first = output.byteOffset / BYTES_PER_WORD
      return words.slice(first, first + output.floatCount)
    })
  })

const getEmulatorCall = (
  definition: DifferentialDefinition,
  precision: EmulatorPrecision,
  input: readonly number[]
): EmulatorCall => ({
  address: definition.address,
  convention: definition.convention,
  precision,
  arguments: definition.slots.flatMap((slot) => getArgumentsForSlot(slot, input)),
  buffers: definition.slots.flatMap((slot) => {
    const buffer = getBufferForSlot(slot, input)
    return buffer === null ? [] : [buffer]
  }),
})

const getBatches = <Item>(items: readonly Item[]): readonly (readonly Item[])[] =>
  Array.from({ length: Math.ceil(items.length / MAXIMUM_CALLS_PER_BATCH) }, (_, batchIndex) =>
    items.slice(batchIndex * MAXIMUM_CALLS_PER_BATCH, (batchIndex + 1) * MAXIMUM_CALLS_PER_BATCH)
  )

// Runs every input through the original code and the port; the results are compared bit for bit.
export const runDifferential = async (
  session: EmulatorSession,
  definition: DifferentialDefinition,
  precision: EmulatorPrecision,
  inputs: readonly (readonly number[])[]
): Promise<DifferentialReport> => {
  const mismatches: DifferentialMismatch[] = []
  let caseCount = 0
  let mismatchCount = 0
  const outputMismatchCounts: (number | undefined)[] = []
  for (const batch of getBatches(inputs)) {
    const results = await session.callBatch(
      batch.map((input) => getEmulatorCall(definition, precision, input))
    )
    for (const [batchIndex, input] of batch.entries()) {
      const originalBits = getOutputBits(definition.slots, results[batchIndex])
      const portBits = definition.runPort(precision, input).map(getBitsFromFloat)
      const isSame =
        originalBits.length === portBits.length &&
        originalBits.every((bits, index) => getIsSameFloatBits(bits, portBits[index] ?? 0))
      originalBits.forEach((bits, index) => {
        if (!getIsSameFloatBits(bits, portBits[index] ?? 0)) {
          outputMismatchCounts[index] = (outputMismatchCounts[index] ?? 0) + 1
        }
      })
      if (!isSame) mismatchCount += 1
      if (!isSame && mismatches.length < MAXIMUM_REPORTED_MISMATCHES) {
        mismatches.push({ functionName: definition.name, precision, input, originalBits, portBits })
      }
      caseCount += 1
    }
  }
  return {
    functionName: definition.name,
    precision,
    caseCount,
    mismatchCount,
    outputMismatchCounts: Array.from(outputMismatchCounts, (count) => count ?? 0),
    mismatches,
  }
}

const formatInput = (input: readonly number[]): string =>
  input.map((value) => formatBits(getBitsFromFloat(value))).join(', ')

const describeOutputMismatchCounts = (report: DifferentialReport): string =>
  `${String(report.mismatchCount)} of ${String(report.caseCount)} cases differ; mismatches per output float: [${report.outputMismatchCounts.join(', ')}]\n`

export const describeReport = (report: DifferentialReport): string =>
  describeOutputMismatchCounts(report) +
  report.mismatches
    .map(
      (mismatch) =>
        `${mismatch.functionName} (${mismatch.precision}) input [${formatInput(mismatch.input)}]\n` +
        `  original [${mismatch.originalBits.map(formatBits).join(', ')}]\n` +
        `  port     [${mismatch.portBits.map(formatBits).join(', ')}]`
    )
    .join('\n')

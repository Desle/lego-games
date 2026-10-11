import { getIsSameFloatBits } from '../../../../shared/emulator/float-bits.ts'
import type {
  FieldDivergence,
  TraceComparison,
  TraceFields,
  TraceFrame,
} from '../../types/golden-trace.types.ts'

const getFirstDifference = (
  frame: number,
  original: TraceFields,
  port: TraceFields,
  fieldNames: readonly string[]
): readonly FieldDivergence[] =>
  fieldNames.flatMap((field) => {
    const originalWords = original[field] ?? []
    const portWords = port[field] ?? []
    const length = Math.max(originalWords.length, portWords.length)
    for (let wordIndex = 0; wordIndex < length; wordIndex += 1) {
      const originalBits = originalWords[wordIndex] ?? -1
      const portBits = portWords[wordIndex] ?? -1
      if (!getIsSameFloatBits(originalBits, portBits)) {
        return [{ frame, field, wordIndex, originalBits, portBits, differingFrameCount: 1 }]
      }
    }
    return []
  })

// Compares two traces frame by frame and field by field, bit for bit (any NaN equals any NaN). `fieldNames`
// keeps the report's order stable and limits the comparison to fields both sides observe.
export const compareTraces = (
  original: readonly TraceFrame[],
  port: readonly TraceFrame[],
  fieldNames: readonly string[]
): TraceComparison => {
  const frameCount = Math.min(original.length, port.length)
  const seenFields = new Set<string>()
  const divergenceByField: FieldDivergence[] = []
  let firstDivergence: FieldDivergence | null = null
  for (let frame = 0; frame < frameCount; frame += 1) {
    const originalFrame = original[frame]
    const portFrame = port[frame]
    if (originalFrame === undefined || portFrame === undefined) break
    const differences = getFirstDifference(
      frame,
      originalFrame.fields,
      portFrame.fields,
      fieldNames
    )
    firstDivergence ??= differences[0] ?? null
    for (const difference of differences) {
      if (!seenFields.has(difference.field)) {
        seenFields.add(difference.field)
        divergenceByField.push(difference)
      } else {
        const index = divergenceByField.findIndex((entry) => entry.field === difference.field)
        const entry = divergenceByField[index]
        if (entry !== undefined) {
          divergenceByField[index] = {
            ...entry,
            differingFrameCount: entry.differingFrameCount + 1,
          }
        }
      }
    }
  }
  return { frameCount, firstDivergence, divergenceByField }
}

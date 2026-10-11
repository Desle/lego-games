import type { TraceFrame } from '../../types/golden-trace.types.ts'
import { compareTraces } from './compare-traces.ts'

const NOT_A_NUMBER_BITS = 0x7fc00000
const OTHER_NOT_A_NUMBER_BITS = 0xffc00000

const createFrame = (frame: number, fields: Record<string, readonly number[]>): TraceFrame => ({
  frame,
  milliseconds: 33,
  fields,
})

describe('compareTraces', () => {
  it('reports no divergence for traces that match bit for bit', () => {
    // Arrange
    const trace = [createFrame(0, { 'racer0.body.speed': [0x3f800000] })]

    // Act
    const comparison = compareTraces(trace, trace, ['racer0.body.speed'])

    // Assert
    expect(comparison.firstDivergence).toBeNull()
    expect(comparison.divergenceByField).toEqual([])
    expect(comparison.frameCount).toBe(1)
  })

  it('reports the first frame, field and word that differ, with both values', () => {
    // Arrange
    const original = [
      createFrame(0, { a: [1, 2], b: [5] }),
      createFrame(1, { a: [1, 2], b: [6] }),
      createFrame(2, { a: [1, 3], b: [7] }),
    ]
    const port = [
      createFrame(0, { a: [1, 2], b: [5] }),
      createFrame(1, { a: [1, 2], b: [9] }),
      createFrame(2, { a: [1, 4], b: [8] }),
    ]

    // Act
    const comparison = compareTraces(original, port, ['a', 'b'])

    // Assert
    expect(comparison.firstDivergence).toMatchObject({
      frame: 1,
      field: 'b',
      wordIndex: 0,
      originalBits: 6,
      portBits: 9,
    })
    expect(comparison.divergenceByField[0]?.differingFrameCount).toBe(2)
    expect(comparison.divergenceByField.map((divergence) => divergence.field)).toEqual(['b', 'a'])
    expect(comparison.divergenceByField[1]?.frame).toBe(2)
  })

  it('counts any two not-a-number values as equal and compares only the fields it is given', () => {
    // Arrange
    const original = [createFrame(0, { a: [NOT_A_NUMBER_BITS], ignored: [1] })]
    const port = [createFrame(0, { a: [OTHER_NOT_A_NUMBER_BITS], ignored: [2] })]

    // Act
    const comparison = compareTraces(original, port, ['a'])

    // Assert
    expect(comparison.firstDivergence).toBeNull()
  })
})

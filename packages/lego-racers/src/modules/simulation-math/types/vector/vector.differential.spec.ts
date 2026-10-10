import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import type { EmulatorPrecision } from '../../../../shared/emulator/emulator-client.types.ts'
import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import { getNormalizedVector2, getNormalizedVector3, getVectorRotatedAroundAxis } from './vector.ts'

const normalizeVector3 = (precision: EmulatorPrecision, input: readonly number[]) => {
  const { x, y, z } = getNormalizedVector3(createFloatArithmetic(precision), {
    x: input[0] ?? 0,
    y: input[1] ?? 0,
    z: input[2] ?? 0,
  })
  return [x, y, z]
}

// Math_NormalizeVector2 0x00449280 (fastcall: ECX source, EDX target)
defineDifferentialSuite({
  definition: {
    name: 'Math_NormalizeVector2',
    address: 0x00449280,
    convention: 'fastcall',
    slots: [
      { kind: 'floats', name: 'source', start: 0, count: 2, isRead: false },
      { kind: 'output', name: 'target', floatCount: 2 },
    ],
    runPort: (precision, input) => {
      const { x, y } = getNormalizedVector2(createFloatArithmetic(precision), {
        x: input[0] ?? 0,
        y: input[1] ?? 0,
      })
      return [x, y]
    },
  },
  generateInput: (sampler) => sampler.sampleList(2, 10),
  fixedInputs: [
    [0, 0],
    [-0, 0],
    [3, 4],
  ],
})

// Math_NormalizeVector3 0x004492d0 (fastcall: ECX source, EDX target)
defineDifferentialSuite({
  definition: {
    name: 'Math_NormalizeVector3',
    address: 0x004492d0,
    convention: 'fastcall',
    slots: [
      { kind: 'floats', name: 'source', start: 0, count: 3, isRead: false },
      { kind: 'output', name: 'target', floatCount: 3 },
    ],
    runPort: normalizeVector3,
  },
  generateInput: (sampler) => sampler.sampleList(3, 10),
  fixedInputs: [
    [0, 0, 0],
    [1, 2, 3],
    [Number.NaN, 1, 2],
  ],
})

// Math_NormalizeVector3 with the target equal to the source ("the target may be the source")
defineDifferentialSuite({
  definition: {
    name: 'Math_NormalizeVector3 in place',
    address: 0x004492d0,
    convention: 'fastcall',
    slots: [
      { kind: 'floats', name: 'vector', start: 0, count: 3, isRead: true },
      { kind: 'reference', name: 'vector' },
    ],
    runPort: normalizeVector3,
  },
  generateInput: (sampler) => sampler.sampleList(3, 10),
})

// Math_RotateVectorAroundAxis 0x004496a0 (cdecl: vector, target, axis, angle)
defineDifferentialSuite({
  definition: {
    name: 'Math_RotateVectorAroundAxis',
    address: 0x004496a0,
    convention: 'cdecl',
    slots: [
      { kind: 'floats', name: 'vector', start: 0, count: 3, isRead: false },
      { kind: 'output', name: 'target', floatCount: 3 },
      { kind: 'floats', name: 'axis', start: 3, count: 3, isRead: false },
      { kind: 'float', index: 6 },
    ],
    runPort: (precision, input) => {
      const { x, y, z } = getVectorRotatedAroundAxis(
        createFloatArithmetic(precision),
        { x: input[0] ?? 0, y: input[1] ?? 0, z: input[2] ?? 0 },
        { x: input[3] ?? 0, y: input[4] ?? 0, z: input[5] ?? 0 },
        input[6] ?? 0
      )
      return [x, y, z]
    },
  },
  generateInput: (sampler) => [...sampler.sampleList(6, 4), sampler.sampleAngle(7)],
})

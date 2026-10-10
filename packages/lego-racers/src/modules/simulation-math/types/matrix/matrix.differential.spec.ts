import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import type { Matrix3 } from '../simulation-math.types.ts'
import { getMatrixInFrame, getMatrixProduct } from './matrix.ts'

const FRAME_ROTATION_FLOAT_OFFSET = 0x28 / 4
const FRAME_FLOAT_COUNT = FRAME_ROTATION_FLOAT_OFFSET + 9

const toMatrix = (values: readonly number[], start: number): Matrix3 => [
  values[start] ?? 0,
  values[start + 1] ?? 0,
  values[start + 2] ?? 0,
  values[start + 3] ?? 0,
  values[start + 4] ?? 0,
  values[start + 5] ?? 0,
  values[start + 6] ?? 0,
  values[start + 7] ?? 0,
  values[start + 8] ?? 0,
]

// Math_MultiplyMatrix3 0x00449190 (cdecl: left, right, target)
defineDifferentialSuite({
  definition: {
    name: 'Math_MultiplyMatrix3',
    address: 0x00449190,
    convention: 'cdecl',
    slots: [
      { kind: 'floats', name: 'left', start: 0, count: 9, isRead: false },
      { kind: 'floats', name: 'right', start: 9, count: 9, isRead: false },
      { kind: 'output', name: 'product', floatCount: 9 },
    ],
    runPort: (precision, input) =>
      getMatrixProduct(createFloatArithmetic(precision), toMatrix(input, 0), toMatrix(input, 9)),
  },
  generateInput: (sampler) => sampler.sampleList(18, 3),
})

// Frame_GetMatrixInFrame 0x00410f30 (thiscall: frame, matrix, target), the rotation at frame +0x28
defineDifferentialSuite({
  definition: {
    name: 'Frame_GetMatrixInFrame',
    address: 0x00410f30,
    convention: 'thiscall',
    slots: [
      { kind: 'floats', name: 'frame', start: 0, count: FRAME_FLOAT_COUNT, isRead: false },
      { kind: 'floats', name: 'matrix', start: FRAME_FLOAT_COUNT, count: 9, isRead: false },
      { kind: 'output', name: 'result', floatCount: 9 },
    ],
    runPort: (precision, input) =>
      getMatrixInFrame(
        createFloatArithmetic(precision),
        toMatrix(input, FRAME_ROTATION_FLOAT_OFFSET),
        toMatrix(input, FRAME_FLOAT_COUNT)
      ),
  },
  generateInput: (sampler) => [
    ...Array.from({ length: FRAME_ROTATION_FLOAT_OFFSET }, () => 0),
    ...sampler.sampleList(18, 3),
  ],
})

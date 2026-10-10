import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import type { Quaternion } from '../simulation-math.types.ts'
import {
  getBlendedQuaternion,
  getMatrixFromQuaternion,
  getQuaternionFromMatrix,
} from './quaternion.ts'

const toQuaternion = (values: readonly number[], start: number): Quaternion => ({
  x: values[start] ?? 0,
  y: values[start + 1] ?? 0,
  z: values[start + 2] ?? 0,
  w: values[start + 3] ?? 0,
})

const toList = ({ x, y, z, w }: Quaternion): readonly number[] => [x, y, z, w]

// Math_QuaternionToMatrix 0x00449340 (cdecl: quaternion, target)
defineDifferentialSuite({
  definition: {
    name: 'Math_QuaternionToMatrix',
    address: 0x00449340,
    convention: 'cdecl',
    slots: [
      { kind: 'floats', name: 'quaternion', start: 0, count: 4, isRead: false },
      { kind: 'output', name: 'matrix', floatCount: 9 },
    ],
    runPort: (precision, input) =>
      getMatrixFromQuaternion(createFloatArithmetic(precision), toQuaternion(input, 0)),
  },
  generateInput: (sampler) => sampler.sampleList(4, 2),
  fixedInputs: [
    [0, 0, 0, 0],
    [0, 0, 0, 1],
  ],
})

// Math_MatrixToQuaternion 0x00449460 (cdecl: matrix, target)
defineDifferentialSuite({
  definition: {
    name: 'Math_MatrixToQuaternion',
    address: 0x00449460,
    convention: 'cdecl',
    slots: [
      { kind: 'floats', name: 'matrix', start: 0, count: 9, isRead: false },
      { kind: 'output', name: 'quaternion', floatCount: 4 },
    ],
    runPort: (precision, input) =>
      toList(
        getQuaternionFromMatrix(createFloatArithmetic(precision), [
          input[0] ?? 0,
          input[1] ?? 0,
          input[2] ?? 0,
          input[3] ?? 0,
          input[4] ?? 0,
          input[5] ?? 0,
          input[6] ?? 0,
          input[7] ?? 0,
          input[8] ?? 0,
        ])
      ),
  },
  generateInput: (sampler) => sampler.sampleList(9, 2),
  fixedInputs: [[1, 0, 0, 0, 1, 0, 0, 0, 1]],
})

// Math_BlendQuaternions 0x004495e0 (cdecl: from, to, fraction, target)
defineDifferentialSuite({
  definition: {
    name: 'Math_BlendQuaternions',
    address: 0x004495e0,
    convention: 'cdecl',
    slots: [
      { kind: 'floats', name: 'from', start: 0, count: 4, isRead: false },
      { kind: 'floats', name: 'to', start: 4, count: 4, isRead: false },
      { kind: 'float', index: 8 },
      { kind: 'output', name: 'target', floatCount: 4 },
    ],
    runPort: (precision, input) =>
      toList(
        getBlendedQuaternion(
          createFloatArithmetic(precision),
          toQuaternion(input, 0),
          toQuaternion(input, 4),
          input[8] ?? 0
        )
      ),
  },
  generateInput: (sampler) => sampler.sampleList(9, 2),
})

import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import {
  getFrameAxes,
  getRotationFromFirstAndSecondAxes,
  getRotationFromFrameAxes,
  getRotationFromThirdAndFirstAxes,
} from './frame-axes.ts'

const FRAME_ROTATION_FLOAT_OFFSET = 0x28 / 4

// Two axes: half the cases nearly orthonormal (where the Gram-Schmidt step cancels), half arbitrary.
const generateAxisPair = (sampler: FloatSampler): readonly number[] =>
  sampler.getIsChance(50)
    ? [
        1 + sampler.sampleUniform(0.1),
        sampler.sampleUniform(0.1),
        sampler.sampleUniform(0.1),
        sampler.sampleUniform(0.1),
        1 + sampler.sampleUniform(0.1),
        sampler.sampleUniform(0.1),
      ]
    : sampler.sampleList(6, 2)

const toVector = (input: readonly number[], start: number) => ({
  x: input[start] ?? 0,
  y: input[start + 1] ?? 0,
  z: input[start + 2] ?? 0,
})

// Frame_GetAxes 0x00403c90 (thiscall: frame, first target, third target; the callee pops 8 bytes), rotation at frame +0x28
defineDifferentialSuite({
  definition: {
    name: 'Frame_GetAxes',
    address: 0x00403c90,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'frame',
        byteSize: 0x80,
        isArgument: true,
        fields: [{ byteOffset: 0x28, start: 0, count: 9 }],
        pointers: [],
        outputs: [],
      },
      { kind: 'output', name: 'first', floatCount: 3 },
      { kind: 'output', name: 'third', floatCount: 3 },
    ],
    runPort: (_precision, input) => {
      const { first, third } = getFrameAxes([
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
      return [first.x, first.y, first.z, third.x, third.y, third.z]
    },
  },
  generateInput: (sampler) => sampler.sampleList(9, 2),
})

// Frame_SetAxes 0x00410900 (thiscall: frame, first, third; the callee pops 8 bytes), rotation written at frame +0x28
defineDifferentialSuite({
  definition: {
    name: 'Frame_SetAxes',
    address: 0x00410900,
    convention: 'thiscall',
    slots: [
      { kind: 'output', name: 'frame', floatCount: 9, skipFloats: FRAME_ROTATION_FLOAT_OFFSET },
      { kind: 'floats', name: 'first', start: 0, count: 3, isRead: false },
      { kind: 'floats', name: 'third', start: 3, count: 3, isRead: false },
    ],
    runPort: (precision, input) =>
      getRotationFromFrameAxes(createFloatArithmetic(precision), {
        first: { x: input[0] ?? 0, y: input[1] ?? 0, z: input[2] ?? 0 },
        third: { x: input[3] ?? 0, y: input[4] ?? 0, z: input[5] ?? 0 },
      }),
  },
  generateInput: generateAxisPair,
  fixedInputs: [[1, 0, 0, 0, 0, 1]],
})

// 0x00410a00 (thiscall: frame, first, second; the callee pops 8 bytes), rotation written at frame +0x28
defineDifferentialSuite({
  definition: {
    name: 'Frame_SetFirstAndSecondAxes',
    address: 0x00410a00,
    convention: 'thiscall',
    slots: [
      { kind: 'output', name: 'frame', floatCount: 9, skipFloats: FRAME_ROTATION_FLOAT_OFFSET },
      { kind: 'floats', name: 'first', start: 0, count: 3, isRead: false },
      { kind: 'floats', name: 'second', start: 3, count: 3, isRead: false },
    ],
    runPort: (precision, input) =>
      getRotationFromFirstAndSecondAxes(
        createFloatArithmetic(precision),
        toVector(input, 0),
        toVector(input, 3)
      ),
  },
  generateInput: generateAxisPair,
})

// 0x00410b00 (thiscall: frame, third, first; the callee pops 8 bytes), rotation written at frame +0x28
defineDifferentialSuite({
  definition: {
    name: 'Frame_SetThirdAndFirstAxes',
    address: 0x00410b00,
    convention: 'thiscall',
    slots: [
      { kind: 'output', name: 'frame', floatCount: 9, skipFloats: FRAME_ROTATION_FLOAT_OFFSET },
      { kind: 'floats', name: 'third', start: 0, count: 3, isRead: false },
      { kind: 'floats', name: 'first', start: 3, count: 3, isRead: false },
    ],
    runPort: (precision, input) =>
      getRotationFromThirdAndFirstAxes(
        createFloatArithmetic(precision),
        toVector(input, 0),
        toVector(input, 3)
      ),
  },
  generateInput: generateAxisPair,
})

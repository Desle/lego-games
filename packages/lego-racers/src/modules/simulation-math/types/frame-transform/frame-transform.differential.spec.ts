import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import type { EmulatorPrecision } from '../../../../shared/emulator/emulator-client.types.ts'
import type { DifferentialSuite } from '../../../../shared/emulator/differential.types.ts'
import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import type { FloatArithmetic, Frame, Matrix3, Vector3 } from '../simulation-math.types.ts'
import {
  getFrameInverseRotatedVector,
  getFrameInverseTransformedPoint,
  getFrameRotatedVector,
  getFrameTransformedPoint,
} from './frame-transform.ts'

const FRAME_BYTE_SIZE = 0x80
const FRAME_ROTATION_OFFSET = 0x28
const FRAME_POSITION_OFFSET = 0x4c

// Input: rotation (9), position (3), point (3).
const getFrame = (input: readonly number[]): Frame => ({
  rotation: input.slice(0, 9) as unknown as Matrix3,
  position: { x: input[9] ?? 0, y: input[10] ?? 0, z: input[11] ?? 0 },
})

const getPoint = (input: readonly number[]): Vector3 => ({
  x: input[12] ?? 0,
  y: input[13] ?? 0,
  z: input[14] ?? 0,
})

const defineFrameTransformSuite = (
  name: string,
  address: number,
  transform: (arithmetic: FloatArithmetic, frame: Frame, point: Vector3) => Vector3
): ReturnType<typeof defineDifferentialSuite> => {
  const suite: DifferentialSuite = {
    definition: {
      name,
      address,
      convention: 'thiscall',
      slots: [
        {
          kind: 'struct',
          name: 'frame',
          byteSize: FRAME_BYTE_SIZE,
          isArgument: true,
          fields: [
            { byteOffset: FRAME_ROTATION_OFFSET, start: 0, count: 9 },
            { byteOffset: FRAME_POSITION_OFFSET, start: 9, count: 3 },
          ],
          pointers: [],
          outputs: [],
        },
        { kind: 'floats', name: 'point', start: 12, count: 3, isRead: false },
        { kind: 'output', name: 'result', floatCount: 3 },
      ],
      runPort: (precision: EmulatorPrecision, input) => {
        const { x, y, z } = transform(
          createFloatArithmetic(precision),
          getFrame(input),
          getPoint(input)
        )
        return [x, y, z]
      },
    },
    generateInput: (sampler) => sampler.sampleList(15, 20),
  }
  return defineDifferentialSuite(suite)
}

// Frame slot +0x34 (thiscall: frame, vector, target)
defineFrameTransformSuite('Frame_RotateVector', 0x00410c80, getFrameRotatedVector)
// Frame slot +0x38
defineFrameTransformSuite('Frame_InverseRotateVector', 0x00410cf0, getFrameInverseRotatedVector)
// Frame slot +0x2c
defineFrameTransformSuite('Frame_TransformPoint', 0x00410d60, getFrameTransformedPoint)
// Frame slot +0x30
defineFrameTransformSuite(
  'Frame_InverseTransformPoint',
  0x00410de0,
  getFrameInverseTransformedPoint
)

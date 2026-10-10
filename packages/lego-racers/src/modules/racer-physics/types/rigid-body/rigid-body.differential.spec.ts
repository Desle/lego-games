import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import {
  BLANK_RIGID_BODY,
  FRAME_BYTE_SIZE,
  FRAME_OFFSET,
  RIGID_BODY_BYTE_SIZE,
  RIGID_BODY_OFFSET,
  toMatrix3,
  toVector3,
} from '../rigid-body-layout/rigid-body-layout.ts'
import { getAngularVelocity, getBoxInertia, getWorldInverseInertia } from './rigid-body.ts'

// BoxRigidBody_ComputeInertia 0x00441260 (thiscall: body). Input: mass, dimensions.
defineDifferentialSuite({
  definition: {
    name: 'BoxRigidBody_ComputeInertia',
    address: 0x00441260,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'body',
        byteSize: RIGID_BODY_BYTE_SIZE,
        isArgument: true,
        fields: [
          { byteOffset: RIGID_BODY_OFFSET.mass, start: 0, count: 1 },
          { byteOffset: RIGID_BODY_OFFSET.dimensions, start: 1, count: 3 },
        ],
        pointers: [],
        outputs: [
          { byteOffset: RIGID_BODY_OFFSET.localInertia, floatCount: 9 },
          { byteOffset: RIGID_BODY_OFFSET.localInverseInertia, floatCount: 9 },
        ],
      },
    ],
    runPort: (precision, input) => {
      const { localInertia, localInverseInertia } = getBoxInertia(
        createFloatArithmetic(precision),
        input[0] ?? 0,
        toVector3(input, 1)
      )
      return [...localInertia, ...localInverseInertia]
    },
  },
  generateInput: (sampler) => sampler.sampleList(4, 10),
  fixedInputs: [[1, 1, 1, 1]],
})

// RigidBody_UpdateWorldInverseInertia 0x00440a60 (thiscall: body; calls the frame method 0x00410f30 on body +0x04).
defineDifferentialSuite({
  definition: {
    name: 'RigidBody_UpdateWorldInverseInertia',
    address: 0x00440a60,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'body',
        byteSize: RIGID_BODY_BYTE_SIZE,
        isArgument: true,
        fields: [{ byteOffset: RIGID_BODY_OFFSET.localInverseInertia, start: 9, count: 9 }],
        pointers: [{ byteOffset: RIGID_BODY_OFFSET.frame, target: { buffer: 'frame' } }],
        outputs: [{ byteOffset: RIGID_BODY_OFFSET.worldInverseInertia, floatCount: 9 }],
      },
      {
        kind: 'struct',
        name: 'frame',
        byteSize: FRAME_BYTE_SIZE,
        isArgument: false,
        fields: [{ byteOffset: FRAME_OFFSET.rotation, start: 0, count: 9 }],
        pointers: [],
        outputs: [],
      },
    ],
    runPort: (precision, input) =>
      getWorldInverseInertia(createFloatArithmetic(precision), {
        ...BLANK_RIGID_BODY,
        frame: { rotation: toMatrix3(input, 0), position: BLANK_RIGID_BODY.frame.position },
        localInverseInertia: toMatrix3(input, 9),
      }),
  },
  generateInput: (sampler) => sampler.sampleList(18, 3),
})

// RigidBody_UpdateAngularVelocity 0x00440a80 (thiscall: body). Input: world inverse inertia, angular momentum.
defineDifferentialSuite({
  definition: {
    name: 'RigidBody_UpdateAngularVelocity',
    address: 0x00440a80,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'body',
        byteSize: RIGID_BODY_BYTE_SIZE,
        isArgument: true,
        fields: [
          { byteOffset: RIGID_BODY_OFFSET.worldInverseInertia, start: 0, count: 9 },
          { byteOffset: RIGID_BODY_OFFSET.angularMomentum, start: 9, count: 3 },
        ],
        pointers: [],
        outputs: [{ byteOffset: RIGID_BODY_OFFSET.angularVelocity, floatCount: 3 }],
      },
    ],
    runPort: (precision, input) => {
      const { x, y, z } = getAngularVelocity(createFloatArithmetic(precision), {
        ...BLANK_RIGID_BODY,
        worldInverseInertia: toMatrix3(input, 0),
        angularMomentum: toVector3(input, 9),
      })
      return [x, y, z]
    },
  },
  generateInput: (sampler) => sampler.sampleList(12, 5),
})

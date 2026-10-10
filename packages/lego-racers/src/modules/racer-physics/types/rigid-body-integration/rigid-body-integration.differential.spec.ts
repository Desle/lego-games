import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createFloatArithmetic, IDENTITY_MATRIX3 } from '../../../simulation-math/index.ts'
import {
  BLANK_RIGID_BODY,
  FRAME_BYTE_SIZE,
  FRAME_OFFSET,
  RIGID_BODY_BYTE_SIZE,
  RIGID_BODY_OFFSET,
  toList,
  toMatrix3,
  toVector3,
} from '../rigid-body-layout/rigid-body-layout.ts'
import { integrateRigidBody } from './rigid-body-integration.ts'

// The frame's vtable (0x004af700): slots +0x04 Frame_GetPosition, +0x08 Frame_SetPosition, +0x40 Frame_SetAxes, +0x48 Frame_GetAxes.
const FRAME_VTABLE_ADDRESS = 0x004af700

// Input: step, rotation (9), position (3), velocity (3), world inverse inertia (9), angular momentum (3), force (3), torque (3), inverse mass.
const INPUT = Object.freeze({
  step: 0,
  rotation: 1,
  position: 10,
  velocity: 13,
  inertia: 16,
  momentum: 25,
  force: 28,
  torque: 31,
  inverseMass: 34,
})

// Ordinary values most of the time, and exact zeros or tiny values often enough to reach the resting branches.
const generateIntegratorInput = (sampler: FloatSampler): readonly number[] => {
  const rotation = sampler.getIsChance(60)
    ? IDENTITY_MATRIX3.map((value) => value + sampler.sampleUniform(0.05))
    : sampler.sampleList(9, 2)
  const velocity = sampler.getIsChance(30)
    ? sampler.sampleList(3, 0.0002)
    : sampler.sampleList(3, 5)
  const momentum = sampler.getIsChance(30)
    ? sampler.sampleList(3, 0.0002)
    : sampler.sampleList(3, 5)
  const force = sampler.getIsChance(30) ? [0, 0, 0] : sampler.sampleList(3, 1000)
  const torque = sampler.getIsChance(40) ? [0, 0, 0] : sampler.sampleList(3, 100)
  const step = sampler.getIsChance(10)
    ? sampler.sampleIntegerBelow(500)
    : sampler.sampleIntegerBelow(41)
  return [
    step,
    ...rotation,
    ...sampler.sampleList(3, 100),
    ...velocity,
    ...sampler.sampleList(9, 0.5),
    ...momentum,
    ...force,
    ...torque,
    Math.abs(sampler.sampleList(1, 2)[0] ?? 0),
  ]
}

// RigidBody_Integrate 0x00440e10 (thiscall: body, integer milliseconds), through the real frame methods of the original.
defineDifferentialSuite({
  definition: {
    name: 'RigidBody_Integrate',
    address: 0x00440e10,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'body',
        byteSize: RIGID_BODY_BYTE_SIZE,
        isArgument: true,
        fields: [
          { byteOffset: RIGID_BODY_OFFSET.linearVelocity, start: INPUT.velocity, count: 3 },
          { byteOffset: RIGID_BODY_OFFSET.worldInverseInertia, start: INPUT.inertia, count: 9 },
          { byteOffset: RIGID_BODY_OFFSET.angularMomentum, start: INPUT.momentum, count: 3 },
          { byteOffset: RIGID_BODY_OFFSET.force, start: INPUT.force, count: 3 },
          { byteOffset: RIGID_BODY_OFFSET.torque, start: INPUT.torque, count: 3 },
          { byteOffset: RIGID_BODY_OFFSET.inverseMass, start: INPUT.inverseMass, count: 1 },
        ],
        pointers: [{ byteOffset: RIGID_BODY_OFFSET.frame, target: { buffer: 'frame' } }],
        outputs: [
          { byteOffset: RIGID_BODY_OFFSET.linearVelocity, floatCount: 3 },
          { byteOffset: RIGID_BODY_OFFSET.angularVelocity, floatCount: 3 },
          { byteOffset: RIGID_BODY_OFFSET.angularMomentum, floatCount: 3 },
          { byteOffset: RIGID_BODY_OFFSET.force, floatCount: 3 },
          { byteOffset: RIGID_BODY_OFFSET.torque, floatCount: 3 },
        ],
      },
      { kind: 'integerInput', index: INPUT.step },
      {
        kind: 'struct',
        name: 'frame',
        byteSize: FRAME_BYTE_SIZE,
        isArgument: false,
        fields: [
          { byteOffset: FRAME_OFFSET.rotation, start: INPUT.rotation, count: 9 },
          { byteOffset: FRAME_OFFSET.position, start: INPUT.position, count: 3 },
        ],
        pointers: [{ byteOffset: 0, target: FRAME_VTABLE_ADDRESS }],
        outputs: [
          { byteOffset: FRAME_OFFSET.rotation, floatCount: 9 },
          { byteOffset: FRAME_OFFSET.position, floatCount: 3 },
        ],
      },
    ],
    runPort: (precision, input) => {
      const next = integrateRigidBody(
        createFloatArithmetic(precision),
        {
          ...BLANK_RIGID_BODY,
          frame: {
            rotation: toMatrix3(input, INPUT.rotation),
            position: toVector3(input, INPUT.position),
          },
          linearVelocity: toVector3(input, INPUT.velocity),
          worldInverseInertia: toMatrix3(input, INPUT.inertia),
          angularMomentum: toVector3(input, INPUT.momentum),
          force: toVector3(input, INPUT.force),
          torque: toVector3(input, INPUT.torque),
          inverseMass: input[INPUT.inverseMass] ?? 0,
        },
        input[INPUT.step] ?? 0
      )
      return [
        ...toList(next.linearVelocity),
        ...toList(next.angularVelocity),
        ...toList(next.angularMomentum),
        ...toList(next.force),
        ...toList(next.torque),
        ...next.frame.rotation,
        ...toList(next.frame.position),
      ]
    },
  },
  generateInput: generateIntegratorInput,
})

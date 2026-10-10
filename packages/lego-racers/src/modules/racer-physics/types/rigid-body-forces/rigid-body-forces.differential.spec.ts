import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import {
  BLANK_RIGID_BODY,
  RIGID_BODY_BYTE_SIZE,
  RIGID_BODY_OFFSET,
  toList,
  toVector3,
} from '../rigid-body-layout/rigid-body-layout.ts'
import {
  addForce,
  addTorqueOfForceAtPoint,
  removeAngularMomentumAlongAxis,
} from './rigid-body-forces.ts'

// RigidBody_AddForce 0x00440b10 (thiscall: body, force; the callee pops 4 bytes). Input: accumulator, force.
defineDifferentialSuite({
  definition: {
    name: 'RigidBody_AddForce',
    address: 0x00440b10,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'body',
        byteSize: RIGID_BODY_BYTE_SIZE,
        isArgument: true,
        fields: [{ byteOffset: RIGID_BODY_OFFSET.force, start: 0, count: 3 }],
        pointers: [],
        outputs: [{ byteOffset: RIGID_BODY_OFFSET.force, floatCount: 3 }],
      },
      { kind: 'floats', name: 'force', start: 3, count: 3, isRead: false },
    ],
    runPort: (precision, input) =>
      toList(
        addForce(
          createFloatArithmetic(precision),
          { ...BLANK_RIGID_BODY, force: toVector3(input, 0) },
          toVector3(input, 3)
        ).force
      ),
  },
  generateInput: (sampler) => sampler.sampleList(6, 100),
})

// RigidBody_AddTorqueOfForceAtPoint 0x00440b50 (thiscall: body, force, point). Input: centre of mass, torque, force, point.
defineDifferentialSuite({
  definition: {
    name: 'RigidBody_AddTorqueOfForceAtPoint',
    address: 0x00440b50,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'body',
        byteSize: RIGID_BODY_BYTE_SIZE,
        isArgument: true,
        fields: [
          { byteOffset: RIGID_BODY_OFFSET.worldCentreOfMass, start: 0, count: 3 },
          { byteOffset: RIGID_BODY_OFFSET.torque, start: 3, count: 3 },
        ],
        pointers: [],
        outputs: [{ byteOffset: RIGID_BODY_OFFSET.torque, floatCount: 3 }],
      },
      { kind: 'floats', name: 'force', start: 6, count: 3, isRead: false },
      { kind: 'floats', name: 'point', start: 9, count: 3, isRead: false },
    ],
    runPort: (precision, input) =>
      toList(
        addTorqueOfForceAtPoint(
          createFloatArithmetic(precision),
          {
            ...BLANK_RIGID_BODY,
            worldCentreOfMass: toVector3(input, 0),
            torque: toVector3(input, 3),
          },
          toVector3(input, 6),
          toVector3(input, 9)
        ).torque
      ),
  },
  generateInput: (sampler) => sampler.sampleList(12, 50),
})

// RigidBody_RemoveAngularMomentumAlongAxis 0x00440da0 (thiscall: body, axis). Input: angular momentum, axis.
defineDifferentialSuite({
  definition: {
    name: 'RigidBody_RemoveAngularMomentumAlongAxis',
    address: 0x00440da0,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'body',
        byteSize: RIGID_BODY_BYTE_SIZE,
        isArgument: true,
        fields: [{ byteOffset: RIGID_BODY_OFFSET.angularMomentum, start: 0, count: 3 }],
        pointers: [],
        outputs: [{ byteOffset: RIGID_BODY_OFFSET.angularMomentum, floatCount: 3 }],
      },
      { kind: 'floats', name: 'axis', start: 3, count: 3, isRead: false },
    ],
    runPort: (precision, input) =>
      toList(
        removeAngularMomentumAlongAxis(
          createFloatArithmetic(precision),
          { ...BLANK_RIGID_BODY, angularMomentum: toVector3(input, 0) },
          toVector3(input, 3)
        ).angularMomentum
      ),
  },
  generateInput: (sampler) => sampler.sampleList(6, 5),
})

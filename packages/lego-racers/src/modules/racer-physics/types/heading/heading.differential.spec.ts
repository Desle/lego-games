import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import {
  createFloatArithmetic,
  getFloatFromBits,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { CarRigidBodyFlag, createCarRigidBody } from '../car-rigid-body/car-rigid-body.ts'
import { updateHeading } from './heading.ts'

const BODY_BYTE_SIZE = 0x888
const At = Object.freeze({
  frameRotation: 0x10c,
  heading: 0x168,
  groundNormal: 0x174,
  groundedWheelCount: 0x36c,
  forwardSpeed: 0x618,
  throttle: 0x628,
  yawRate: 0x650,
  flags: 0x6c0,
  driftMaximumAngle: 0x6cc,
})

const getUnitVector = (sampler: FloatSampler): readonly [number, number, number] => {
  const [x = 0, y = 0, z = 1] = sampler.sampleList(3, 1)
  const length = Math.hypot(x, y, z) || 1
  return [Math.fround(x / length), Math.fround(y / length), Math.fround(z / length)]
}

// Input: row 0 of the frame (3), heading (3), ground normal (3), forward speed, throttle, yaw rate, drift maximum angle,
// step, grounded wheel count, flags (the last two as raw bits).
const getInput = (sampler: FloatSampler): readonly number[] => {
  const row = getUnitVector(sampler)
  const [nearX, nearY, nearZ] = getUnitVector(sampler)
  const spread = sampler.sampleList(1, 0.4)[0] ?? 0.1
  const heading = [row[0] + nearX * spread, row[1] + nearY * spread, row[2] + nearZ * spread]
  const length = Math.hypot(heading[0] ?? 0, heading[1] ?? 0, heading[2] ?? 0) || 1
  const [speed = 0, throttle = 0, yaw = 0, drift = 0, step = 33] = sampler
    .sampleList(5, 1)
    .map((value) => (Number.isFinite(value) ? value : 0))
  const wheels = sampler.sampleIntegerBelow(5)
  const flags = sampler.getIsChance(0.5) ? CarRigidBodyFlag.DRIFTING : 0
  return [
    ...row,
    ...[0, 0, 0, 0, 0, 0],
    ...heading.map((value) => Math.fround(value / length)),
    ...getUnitVector(sampler),
    Math.abs(speed),
    throttle,
    yaw * 0.01,
    Math.abs(drift),
    Math.trunc(Math.min(Math.abs(step), 1) * 40) + 12,
    getFloatFromBits(wheels),
    getFloatFromBits(flags),
  ]
}

// RigidBody heading update 0x00446fd0 (thiscall: step), which calls 0x00447230 (turn toward) and the drift branch.
defineDifferentialSuite({
  definition: {
    name: 'CarRigidBody_UpdateHeading',
    address: 0x00446fd0,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'body',
        byteSize: BODY_BYTE_SIZE,
        isArgument: true,
        fields: [
          { byteOffset: At.frameRotation, start: 0, count: 9 },
          { byteOffset: At.heading, start: 9, count: 3 },
          { byteOffset: At.groundNormal, start: 12, count: 3 },
          { byteOffset: At.forwardSpeed, start: 15, count: 1 },
          { byteOffset: At.throttle, start: 16, count: 1 },
          { byteOffset: At.yawRate, start: 17, count: 1 },
          { byteOffset: At.driftMaximumAngle, start: 18, count: 1 },
          { byteOffset: At.groundedWheelCount, start: 20, count: 1 },
          { byteOffset: At.flags, start: 21, count: 1 },
        ],
        pointers: [],
        outputs: [{ byteOffset: At.heading, floatCount: 3 }],
      },
      { kind: 'integerInput', index: 19 },
    ],
    runPort: (precision, input) => {
      const arithmetic = createFloatArithmetic(precision)
      const body = createCarRigidBody(arithmetic, {
        displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
        displayBoundingRadius: 5,
        mass: 1,
        dimensions: { x: 8, y: 5, z: 6.2 },
      })
      const rotation = [...input.slice(0, 9)] as unknown as typeof IDENTITY_MATRIX3
      const wheels = new Uint32Array(new Float32Array([input[20] ?? 0]).buffer)[0] ?? 0
      const flags = new Uint32Array(new Float32Array([input[21] ?? 0]).buffer)[0] ?? 0
      const { heading } = updateHeading(
        arithmetic,
        {
          ...body,
          frame: { rotation, position: body.frame.position },
          heading: { x: input[9] ?? 0, y: input[10] ?? 0, z: input[11] ?? 0 },
          groundNormal: { x: input[12] ?? 0, y: input[13] ?? 0, z: input[14] ?? 0 },
          forwardSpeed: input[15] ?? 0,
          throttle: input[16] ?? 0,
          yawRate: input[17] ?? 0,
          driftMaximumAngle: input[18] ?? 0,
          groundedWheelCount: wheels,
          flags,
        },
        input[19] ?? 33
      )
      return [heading.x, heading.y, heading.z]
    },
  },
  generateInput: getInput,
})

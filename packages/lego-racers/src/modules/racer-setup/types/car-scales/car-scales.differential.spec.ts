import { defineDifferentialSuite } from '../../../../shared/emulator/differential-suite.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createCarRigidBody, setThrottle } from '../../../racer-physics/index.ts'
import {
  createFloatArithmetic,
  IDENTITY_MATRIX3,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import { getRatingScale, getSteeringScale, setTopSpeedRating } from './car-scales.ts'

// The car body is 0x7f0 bytes here; its vtable (0x004b04e4) is the original's own, so slot 6 runs 0x0042ad50.
const CAR_BODY_BYTE_SIZE = 0x7f0
const CAR_BODY_VTABLE_ADDRESS = 0x004b04e4
const OFFSET = Object.freeze({
  mass: 0xc8,
  drag: 0x5ec,
  gripScale: 0x5f4,
  topSpeed: 0x608,
  throttle: 0x628,
  steeringScale: 0x728,
  throttleScale: 0x72c,
  topSpeedScale: 0x730,
  baseTopSpeed: 0x734,
})
const MAXIMUM_RATING = 200

// Ratings are bytes of the chassis plus a weight bonus, so 0 to 200 covers every value the race can pass.
const generateRating = (sampler: FloatSampler): readonly number[] => [
  sampler.sampleIntegerBelow(MAXIMUM_RATING + 1),
]

const getRatingSuite = (
  name: string,
  address: number,
  scaleOffset: number,
  getScale: (precision: 'single' | 'double', rating: number) => number
) =>
  defineDifferentialSuite({
    definition: {
      name,
      address,
      convention: 'thiscall',
      slots: [
        {
          kind: 'struct',
          name: 'carBody',
          byteSize: CAR_BODY_BYTE_SIZE,
          isArgument: true,
          fields: [],
          pointers: [],
          outputs: [{ byteOffset: scaleOffset, floatCount: 1 }],
        },
        { kind: 'integerInput', index: 0 },
      ],
      runPort: (precision, input) => [getScale(precision, input[0] ?? 0)],
    },
    generateInput: generateRating,
    fixedInputs: [[0], [50], [100]],
  })

// CarBody_SetSteeringRating 0x0042ad70 (thiscall: car body, integer rating).
getRatingSuite('CarBody_SetSteeringRating', 0x0042ad70, OFFSET.steeringScale, (precision, rating) =>
  getSteeringScale(createFloatArithmetic(precision), rating)
)

// CarBody_SetThrottleRating 0x0042ada0.
getRatingSuite('CarBody_SetThrottleRating', 0x0042ada0, OFFSET.throttleScale, (precision, rating) =>
  getRatingScale(createFloatArithmetic(precision), rating)
)

// CarBody_SetTopSpeedRating 0x0042add0 with the reset 0x00429330 and the top speed setter 0x0042ad50 → 0x00448390:
// the scale, the top speed, the drag, the grip scale and the base top speed.
defineDifferentialSuite({
  definition: {
    name: 'CarBody_SetTopSpeedRating',
    address: 0x0042add0,
    convention: 'thiscall',
    slots: [
      {
        kind: 'struct',
        name: 'carBody',
        byteSize: CAR_BODY_BYTE_SIZE,
        isArgument: true,
        fields: [
          { byteOffset: OFFSET.mass, start: 1, count: 1 },
          { byteOffset: OFFSET.throttle, start: 2, count: 1 },
        ],
        pointers: [{ byteOffset: 0, target: CAR_BODY_VTABLE_ADDRESS }],
        outputs: [
          { byteOffset: OFFSET.topSpeedScale, floatCount: 1 },
          { byteOffset: OFFSET.topSpeed, floatCount: 1 },
          { byteOffset: OFFSET.drag, floatCount: 1 },
          { byteOffset: OFFSET.gripScale, floatCount: 1 },
          { byteOffset: OFFSET.baseTopSpeed, floatCount: 1 },
        ],
      },
      { kind: 'integerInput', index: 0 },
    ],
    runPort: (precision, input) => {
      const arithmetic = createFloatArithmetic(precision)
      const body = setThrottle(
        arithmetic,
        createCarRigidBody(arithmetic, {
          displayFrame: { rotation: IDENTITY_MATRIX3, position: ZERO_VECTOR3 },
          displayBoundingRadius: 1,
          mass: input[1] ?? 1,
          dimensions: { x: 8, y: 5, z: 6 },
        }),
        input[2] ?? 0
      )
      const result = setTopSpeedRating(arithmetic, body, input[0] ?? 0)
      return [
        result.scale,
        result.rigidBody.topSpeed,
        result.rigidBody.drag,
        result.rigidBody.gripScale,
        120,
      ]
    },
  },
  generateInput: (sampler) => [
    sampler.sampleIntegerBelow(MAXIMUM_RATING + 1),
    Math.abs(sampler.sampleMixed(10000)) + 1,
    sampler.getIsChance(20) ? 0 : sampler.sampleMixed(1000),
  ],
  fixedInputs: [
    [50, 4500, 0],
    [100, 4500, 432],
    [0, 2500, -432],
  ],
})

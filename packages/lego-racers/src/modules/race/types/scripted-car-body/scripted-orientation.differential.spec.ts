import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat, getIsSameFloatBits } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createCarBody } from '../../../racer/index.ts'
import type { CarBody } from '../../../racer/index.ts'
import { advanceRouteFollower, createRouteFollower } from '../../../racer-ai/index.ts'
import type { RouteFollower } from '../../../racer-ai/index.ts'
import type {
  ComputerRacerRoute,
  ComputerRacerRouteSample,
} from '../../../computer-racer-route/index.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import { createFixtureRacerDefinition } from '../race-fixtures/race-fixtures.ts'
import {
  getBodyWithTwoPointOffsets,
  getScriptedBodyOriented,
  getScriptedBodyWithTargetTilt,
} from './scripted-orientation.ts'

const CAR_BODY_VTABLE = 0x004b04e4
const FRAME_VTABLE = 0x004af700
const BODY_WORDS = 0x888 / 4
const FRAME_WORDS = 0x80 / 4
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const ORIENT_ADDRESS = 0x0042a290
const TWO_POINT_ADDRESS = 0x004464a0

// Byte offsets in the car body (physics.md, racer.md).
const At = Object.freeze({
  displayFrame: 0x13c,
  localWheelAnchor: 0x358,
  wheelOneAnchor: 0x214,
  pitchTimer: 0x5dc,
  yawTimer: 0x5e0,
  flags: 0x6c0,
  twoPointHeight: 0x658,
  twoPointTargetHeight: 0x65c,
  twoPointHeightRate: 0x660,
  twoPointTargetTilt: 0x67c,
  twoPointTilt: 0x680,
  isScripted: 0x744,
  followerRotation: 0x758,
  spinRate: 0x7d4,
  spinTime: 0x7d8,
  flipRate: 0x7dc,
  flipAngle: 0x7e0,
  flipHeight: 0x7e4,
})
// The frame (Gol frame, rotation at +0x28, position at +0x4c).
const FRAME_ROTATION = 0x28
const FRAME_POSITION = 0x4c

type OrientationCase = {
  readonly flags: number
  readonly tilt: number
  readonly pitchTimer: number
  readonly flipRate: number
  readonly flipAngle: number
  readonly yawTimer: number
  readonly spinRate: number
  readonly spinTime: number
  readonly localWheelAnchor: readonly number[]
  readonly quaternion: readonly number[]
  readonly rotation: readonly number[]
  readonly position: readonly number[]
  readonly step: number
}

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleOrientationCase = (sampler: FloatSampler): OrientationCase => ({
  flags: sampleChoice(sampler, 0, 0x2, 0x6, 0x8, 0xa, 0x80),
  tilt: sampler.getIsChance(50) ? 0 : sampler.sampleUniform(0.6),
  pitchTimer: sampler.getIsChance(40) ? 0 : 1 + sampler.sampleIntegerBelow(300),
  flipRate: sampler.getIsChance(10) ? 0 : sampler.sampleUniform(0.01),
  flipAngle: sampler.getIsChance(30) ? 0 : sampler.sampleUniform(3),
  yawTimer: sampler.getIsChance(40) ? 0 : 1 + sampler.sampleIntegerBelow(300),
  spinRate: sampler.sampleUniform(0.02),
  spinTime: sampler.sampleUniform(6),
  localWheelAnchor: sampler.sampleList(3, 3),
  quaternion: Array.from({ length: 4 }, () => sampler.sampleUniform(1)),
  rotation: Array.from({ length: 9 }, () => sampler.sampleUniform(1)),
  position: sampler.sampleList(3, 300),
  step: sampleChoice(sampler, 0, 1, 16, 33, 40, sampler.sampleIntegerBelow(60)),
})

const buildBodyWords = (item: OrientationCase): readonly EmulatorArgument[] => {
  const words = new Array<EmulatorArgument>(BODY_WORDS).fill(0)
  const setFloats = (offset: number, values: readonly number[]): void =>
    values.forEach((value, index) => {
      words[offset / 4 + index] = getBitsFromFloat(value)
    })
  words[0] = CAR_BODY_VTABLE
  words[At.displayFrame / 4] = { buffer: 'frame' }
  words[At.flags / 4] = item.flags
  words[At.pitchTimer / 4] = item.pitchTimer
  words[At.yawTimer / 4] = item.yawTimer
  words[At.isScripted / 4] = 1
  setFloats(At.twoPointTilt, [item.tilt])
  setFloats(At.flipRate, [item.flipRate, item.flipAngle])
  setFloats(At.spinRate, [item.spinRate, item.spinTime])
  setFloats(At.localWheelAnchor, item.localWheelAnchor)
  setFloats(At.followerRotation, item.quaternion)
  return words
}

const buildFrameWords = (item: OrientationCase): readonly EmulatorArgument[] => {
  const words = new Array<EmulatorArgument>(FRAME_WORDS).fill(0)
  words[0] = FRAME_VTABLE
  item.rotation.forEach((value, index) => {
    words[FRAME_ROTATION / 4 + index] = getBitsFromFloat(value)
  })
  item.position.forEach((value, index) => {
    words[FRAME_POSITION / 4 + index] = getBitsFromFloat(value)
  })
  return words
}

const getOrientationCall = (precision: EmulatorPrecision, item: OrientationCase): EmulatorCall => ({
  address: ORIENT_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'body' }, item.step],
  buffers: [
    { name: 'body', words: buildBodyWords(item), isRead: true },
    { name: 'frame', words: buildFrameWords(item), isRead: true },
  ],
})

const getPortBody = (item: OrientationCase): CarBody => {
  const body = createCarBody(createFixtureRacerDefinition(2).carBody)
  const [anchorX, anchorY, anchorZ] = item.localWheelAnchor as [number, number, number]
  const [quaternionX, quaternionY, quaternionZ, quaternionW] = item.quaternion as [
    number,
    number,
    number,
    number,
  ]
  const [positionX, positionY, positionZ] = item.position as [number, number, number]
  return Object.freeze({
    ...body,
    isScripted: true,
    scriptedSpinPeriod: item.spinRate,
    scriptedSpinTime: item.spinTime,
    flipRate: item.flipRate,
    flipAngle: item.flipAngle,
    flipHeight: 0,
    routeFollower: Object.freeze({
      ...createRouteFollower(null, 1),
      rotation: { x: quaternionX, y: quaternionY, z: quaternionZ, w: quaternionW },
    }),
    rigidBody: Object.freeze({
      ...body.rigidBody,
      flags: item.flags,
      twoPointTilt: item.tilt,
      pitchTimer: item.pitchTimer,
      yawTimer: item.yawTimer,
      localWheelAnchor: { x: anchorX, y: anchorY, z: anchorZ },
      wheels: body.rigidBody.wheels.map((wheel) =>
        Object.freeze({ ...wheel, anchor: { x: 0, y: 0, z: 0 } })
      ),
      displayFrame: Object.freeze({
        rotation: Object.freeze([...item.rotation]) as never,
        position: { x: positionX, y: positionY, z: positionZ },
      }),
    }),
  })
}

const getOriginalBits = (body: readonly number[], frame: readonly number[]): readonly number[] => [
  ...Array.from({ length: 9 }, (_, index) => frame[FRAME_ROTATION / 4 + index] ?? 0),
  ...Array.from({ length: 3 }, (_, index) => frame[FRAME_POSITION / 4 + index] ?? 0),
  body[At.pitchTimer / 4] ?? 0,
  body[At.yawTimer / 4] ?? 0,
  body[At.flags / 4] ?? 0,
  body[At.spinTime / 4] ?? 0,
  body[At.flipRate / 4] ?? 0,
  body[At.flipAngle / 4] ?? 0,
  body[At.flipHeight / 4] ?? 0,
  ...Array.from({ length: 3 }, (_, index) => body[At.wheelOneAnchor / 4 + index] ?? 0),
]

const getPortBits = (body: CarBody): readonly number[] => {
  const { rigidBody } = body
  const { rotation, position } = rigidBody.displayFrame
  const anchor = rigidBody.wheels[1]?.anchor ?? { x: 0, y: 0, z: 0 }
  return [
    ...rotation.map(getBitsFromFloat),
    getBitsFromFloat(position.x),
    getBitsFromFloat(position.y),
    getBitsFromFloat(position.z),
    rigidBody.pitchTimer,
    rigidBody.yawTimer,
    rigidBody.flags,
    getBitsFromFloat(body.scriptedSpinTime),
    getBitsFromFloat(body.flipRate),
    getBitsFromFloat(body.flipAngle),
    getBitsFromFloat(body.flipHeight),
    getBitsFromFloat(anchor.x),
    getBitsFromFloat(anchor.y),
    getBitsFromFloat(anchor.z),
  ].map((bits) => bits >>> 0)
}

const expectOrientationMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const arithmetic = createFloatArithmetic(precision)
  const sampler = createFloatSampler(createSeededRandom(0x42a290 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleOrientationCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getOrientationCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const original = getOriginalBits(
      results[index]?.buffers['body'] ?? [],
      results[index]?.buffers['frame'] ?? []
    )
    const ported = getPortBits(getScriptedBodyOriented(arithmetic, getPortBody(item), item.step))
    const differing = original.flatMap((bits, position) =>
      getIsSameFloatBits(bits, ported[position] ?? 0) ? [] : [position]
    )
    return differing.length === 0
      ? []
      : [
          `${String(index)}: outputs ${differing.join()} ${JSON.stringify({ pitch: item.pitchTimer, rate: item.flipRate, angle: item.flipAngle, step: item.step, original: original.slice(19), ported: ported.slice(19) })}`,
        ]
  })

  // Assert
  expect(mismatches.slice(0, 8)).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())(
  'the scripted car body orientation against the original',
  () =>
    it.each(PRECISIONS)(
      '0x0042a290 matches the original bit for bit in %s precision',
      (precision) => expectOrientationMatchesOriginal(precision),
      TEST_TIMEOUT_IN_MILLISECONDS
    )
)

type TwoPointCase = {
  readonly height: number
  readonly targetHeight: number
  readonly rate: number
  readonly tilt: number
  readonly targetTilt: number
  readonly step: number
}

const sampleTwoPointCase = (sampler: FloatSampler): TwoPointCase => ({
  height: sampler.sampleUniform(10),
  targetHeight: sampler.getIsChance(20) ? 0 : sampler.sampleUniform(10),
  rate: sampler.sampleUniform(5000),
  tilt: sampler.sampleUniform(1),
  targetTilt: sampler.getIsChance(20) ? 0 : sampler.sampleUniform(1),
  step: sampleChoice(sampler, 0, 1, 16, 33, 40, sampler.sampleIntegerBelow(500)),
})

const getTwoPointCall = (precision: EmulatorPrecision, item: TwoPointCase): EmulatorCall => {
  const words = new Array<EmulatorArgument>(0x700 / 4).fill(0)
  const set = (offset: number, value: number): void => {
    words[offset / 4] = getBitsFromFloat(value)
  }
  set(At.twoPointHeight, item.height)
  set(At.twoPointTargetHeight, item.targetHeight)
  set(At.twoPointHeightRate, item.rate)
  set(At.twoPointTilt, item.tilt)
  set(At.twoPointTargetTilt, item.targetTilt)
  return {
    address: TWO_POINT_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'body' }, item.step],
    buffers: [{ name: 'body', words, isRead: true }],
  }
}

const expectTwoPointMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const arithmetic = createFloatArithmetic(precision)
  const sampler = createFloatSampler(createSeededRandom(0x4464a0 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleTwoPointCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getTwoPointCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const body = createCarBody(createFixtureRacerDefinition(2).carBody).rigidBody
    const moved = getBodyWithTwoPointOffsets(
      arithmetic,
      Object.freeze({
        ...body,
        twoPointHeight: item.height,
        twoPointTargetHeight: item.targetHeight,
        twoPointHeightRate: item.rate,
        twoPointTilt: item.tilt,
        twoPointTargetTilt: item.targetTilt,
      }),
      item.step
    )
    const words = results[index]?.buffers['body'] ?? []
    const isSame =
      getIsSameFloatBits(
        words[At.twoPointHeight / 4] ?? 0,
        getBitsFromFloat(moved.twoPointHeight)
      ) && getIsSameFloatBits(words[At.twoPointTilt / 4] ?? 0, getBitsFromFloat(moved.twoPointTilt))
    return isSame ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('the two-point offsets against the original', () =>
  it.each(PRECISIONS)(
    '0x004464a0 matches the original bit for bit in %s precision',
    (precision) => expectTwoPointMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

const TARGET_TILT_ADDRESS = 0x0042a100
const FOLLOWER_OFFSET = 0x74c
const FOLLOWER_WORDS = 30

type TargetTiltCase = {
  readonly route: ComputerRacerRoute
  readonly follower: RouteFollower
  readonly flags: number
}

const sampleRouteSample = (sampler: FloatSampler): ComputerRacerRouteSample => ({
  first: sampleChoice(sampler, 0, 100, -100, 256, -256, sampler.sampleIntegerBelow(600) - 300),
  second: sampleChoice(sampler, 0, 100, -100, sampler.sampleIntegerBelow(600) - 300),
  bytes: [
    sampler.sampleIntegerBelow(256),
    sampler.sampleIntegerBelow(256),
    sampler.sampleIntegerBelow(256),
    sampler.sampleIntegerBelow(256),
    sampler.sampleIntegerBelow(256),
    sampler.sampleIntegerBelow(256),
    sampler.sampleIntegerBelow(256),
    (sampler.sampleIntegerBelow(4) << 6) | (1 + sampler.sampleIntegerBelow(63)),
  ],
})

const sampleTargetTiltCase = (
  sampler: FloatSampler,
  arithmetic: ReturnType<typeof createFloatArithmetic>
): TargetTiltCase => {
  const route: ComputerRacerRoute = {
    firstVector: [0, 0, 0],
    firstQuaternion: [0, 0, 0, 1],
    secondVector: [1, 2, 3],
    secondQuaternion: [0, 0, 0, 1],
    firstInteger: 64,
    sampleIndex: 0,
    samples: Array.from({ length: 4 + sampler.sampleIntegerBelow(5) }, () =>
      sampleRouteSample(sampler)
    ),
    readByteCount: 0,
  }
  const started = advanceRouteFollower(
    arithmetic,
    createRouteFollower(route, sampleChoice(sampler, 1, 0.5)),
    sampler.sampleIntegerBelow(800)
  )
  return { route, follower: started, flags: sampleChoice(sampler, 0, 8) }
}

const getSampleWords = (sample: ComputerRacerRouteSample): readonly number[] => {
  const getWord = (start: number): number =>
    (((sample.bytes[start + 3] ?? 0) << 24) |
      ((sample.bytes[start + 2] ?? 0) << 16) |
      ((sample.bytes[start + 1] ?? 0) << 8) |
      (sample.bytes[start] ?? 0)) >>>
    0
  return [((sample.second & 0xffff) << 16) | (sample.first & 0xffff), getWord(0), getWord(4)]
}

const getFollowerWords = (follower: RouteFollower): readonly EmulatorArgument[] => {
  const words = new Array<EmulatorArgument>(FOLLOWER_WORDS).fill(0)
  const setFloats = (word: number, values: readonly number[]): void =>
    values.forEach((value, index) => {
      words[word + index] = getBitsFromFloat(value)
    })
  const { position, rotation, previousPosition, nextPosition, previousRotation, nextRotation } =
    follower
  setFloats(0, [position.x, position.y, position.z])
  setFloats(3, [rotation.x, rotation.y, rotation.z, rotation.w])
  words[7] = follower.contactState
  setFloats(8, [follower.negativeLateralLimit, follower.positiveLateralLimit])
  words[10] = { buffer: 'route' }
  setFloats(11, [follower.speedFactor, follower.time])
  words[13] = follower.previousSampleIndex >>> 0
  words[14] = follower.nextSampleIndex
  setFloats(15, [previousPosition.x, previousPosition.y, previousPosition.z])
  setFloats(18, [nextPosition.x, nextPosition.y, nextPosition.z])
  setFloats(21, [previousRotation.x, previousRotation.y, previousRotation.z, previousRotation.w])
  setFloats(25, [nextRotation.x, nextRotation.y, nextRotation.z, nextRotation.w])
  words[29] = follower.previousTime
  return words
}

const getTargetTiltCall = (precision: EmulatorPrecision, item: TargetTiltCase): EmulatorCall => {
  const body = new Array<EmulatorArgument>(BODY_WORDS).fill(0)
  getFollowerWords(item.follower).forEach((word, index) => {
    body[FOLLOWER_OFFSET / 4 + index] = word
  })
  body[At.flags / 4] = item.flags
  const { route } = item
  return {
    address: TARGET_TILT_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'body' }],
    buffers: [
      { name: 'body', words: body, isRead: true },
      {
        name: 'route',
        words: [
          route.samples.length,
          { buffer: 'samples' },
          0,
          0,
          0,
          ...route.firstQuaternion.map(getBitsFromFloat),
          ...route.secondVector.map(getBitsFromFloat),
          ...route.secondQuaternion.map(getBitsFromFloat),
          route.firstInteger,
          route.sampleIndex,
        ],
        isRead: false,
      },
      { name: 'samples', words: route.samples.flatMap(getSampleWords), isRead: false },
    ],
  }
}

const expectTargetTiltMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const arithmetic = createFloatArithmetic(precision)
  const sampler = createFloatSampler(createSeededRandom(0x42a100 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleTargetTiltCase(sampler, arithmetic))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getTargetTiltCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const body = createCarBody(createFixtureRacerDefinition(2).carBody)
    const tilted = getScriptedBodyWithTargetTilt(
      arithmetic,
      Object.freeze({
        ...body,
        isScripted: true,
        routeFollower: item.follower,
        rigidBody: Object.freeze({ ...body.rigidBody, flags: item.flags }),
      })
    )
    const original = results[index]?.buffers['body']?.[At.twoPointTargetTilt / 4] ?? 0
    return getIsSameFloatBits(original, getBitsFromFloat(tilted.rigidBody.twoPointTargetTilt))
      ? []
      : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())(
  'the scripted car body target tilt against the original',
  () =>
    it.each(PRECISIONS)(
      '0x0042a100 matches the original bit for bit in %s precision',
      (precision) => expectTargetTiltMatchesOriginal(precision),
      TEST_TIMEOUT_IN_MILLISECONDS
    )
)

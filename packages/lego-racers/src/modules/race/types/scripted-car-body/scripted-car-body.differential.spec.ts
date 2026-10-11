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
import type {
  ComputerRacerRoute,
  ComputerRacerRouteSample,
} from '../../../computer-racer-route/index.ts'
import { createCarBody } from '../../../racer/index.ts'
import type { CarBody } from '../../../racer/index.ts'
import { createRouteFollower, getRouteSampleOffset } from '../../../racer-ai/index.ts'
import type { RouteFollower } from '../../../racer-ai/index.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { createFixtureRacerDefinition } from '../race-fixtures/race-fixtures.ts'
import { getBodyAtFollower, getScriptedBodySeparated } from './scripted-car-body.ts'

const PLACE_ADDRESS = 0x0042a570
const SEPARATE_ADDRESS = 0x00429680
const CAR_BODY_VTABLE = 0x004b04e4
const FRAME_VTABLE = 0x004af700
const BODY_WORDS = 0x888 / 4
const FRAME_WORDS = 0x80 / 4
const FOLLOWER_WORDS = 30
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const FRAME_ROTATION = 0x28
const FRAME_POSITION = 0x4c

// Byte offsets in the car body (physics.md, racer.md).
const At = Object.freeze({
  physicsFrame: 0x04,
  localCentreOfMass: 0x14,
  worldCentreOfMass: 0x20,
  localInverseInertia: 0x50,
  worldInverseInertia: 0x74,
  displayFrame: 0x13c,
  heading: 0x168,
  groundedWheelCount: 0x36c,
  localWheelAnchor: 0x358,
  wheelOneAnchor: 0x214,
  pitchTimer: 0x5dc,
  yawTimer: 0x5e0,
  twoPointHeight: 0x658,
  flags: 0x6c0,
  isScripted: 0x744,
  follower: 0x74c,
  twoPointTilt: 0x680,
  spinRate: 0x7d4,
  spinTime: 0x7d8,
  flipRate: 0x7dc,
  flipAngle: 0x7e0,
  flipHeight: 0x7e4,
  bounceHeight: 0x7c8,
  lateralOffset: 0x7cc,
})

type ScriptedCase = {
  readonly route: ComputerRacerRoute
  readonly follower: RouteFollower
  readonly displacement: Vector3
  readonly lateralOffset: number
  readonly bounceHeight: number
  readonly flipHeight: number
  readonly twoPointHeight: number
  readonly twoPointTilt: number
  readonly flags: number
  readonly rotation: readonly number[]
  readonly position: readonly number[]
  readonly physicsRotation: readonly number[]
  readonly localCentreOfMass: readonly number[]
  readonly localInverseInertia: readonly number[]
  readonly localWheelAnchor: readonly number[]
}

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleByte = (sampler: FloatSampler): number => sampler.sampleIntegerBelow(256)

const sampleSample = (sampler: FloatSampler): ComputerRacerRouteSample => ({
  first: sampleChoice(sampler, 0, 0, 100, -100, 256, -256, sampler.sampleIntegerBelow(600) - 300),
  second: sampleChoice(sampler, 0, 0, 100, -100, sampler.sampleIntegerBelow(600) - 300),
  bytes: [
    sampleChoice(sampler, 0, 0, sampleByte(sampler)),
    sampleByte(sampler),
    sampleByte(sampler),
    sampleByte(sampler),
    sampleByte(sampler),
    sampleByte(sampler),
    sampleByte(sampler),
    (sampler.sampleIntegerBelow(4) << 6) | (1 + sampler.sampleIntegerBelow(63)),
  ],
})

const sampleVector = (sampler: FloatSampler, limit: number): Vector3 => ({
  x: Math.fround(sampler.sampleUniform(limit)),
  y: Math.fround(sampler.sampleUniform(limit)),
  z: Math.fround(sampler.sampleUniform(limit)),
})

const sampleScriptedCase = (
  sampler: FloatSampler,
  arithmetic: ReturnType<typeof createFloatArithmetic>
): ScriptedCase => {
  const sampleCount = 3 + sampler.sampleIntegerBelow(5)
  const samples = Array.from({ length: sampleCount }, () => sampleSample(sampler))
  const route: ComputerRacerRoute = {
    firstVector: [0, 0, 0],
    firstQuaternion: [0, 0, 0, 1],
    secondVector: [1, 2, 3],
    secondQuaternion: [0, 0, 0, 1],
    firstInteger: 64,
    sampleIndex: 0,
    samples,
    readByteCount: 0,
  }
  const previousSampleIndex = sampler.sampleIntegerBelow(sampleCount - 1)
  const nextSampleIndex = previousSampleIndex + 1
  const previousPosition = sampleVector(sampler, 50)
  const offset = getRouteSampleOffset(arithmetic, samples[nextSampleIndex] ?? sampleSample(sampler))
  const nextPosition = {
    x: Math.fround(previousPosition.x + offset.x),
    y: Math.fround(previousPosition.y + offset.y),
    z: Math.fround(previousPosition.z + offset.z),
  }
  const follower: RouteFollower = {
    ...createRouteFollower(route, sampleChoice(sampler, 1, 0.5)),
    position: sampleVector(sampler, 50),
    contactState: sampler.sampleIntegerBelow(5),
    negativeLateralLimit: Math.fround(sampler.sampleUniform(5)),
    positiveLateralLimit: Math.fround(sampler.sampleUniform(5)),
    previousSampleIndex,
    nextSampleIndex,
    previousPosition,
    nextPosition,
    previousTime: 32 * sampler.sampleIntegerBelow(40),
    time: Math.fround(sampler.sampleUniform(1000)),
  }
  return {
    route,
    follower,
    displacement: sampler.getIsChance(30)
      ? { x: 0, y: 0, z: 0 }
      : sampleVector(sampler, sampleChoice(sampler, 1, 5, 50)),
    lateralOffset: sampler.getIsChance(20) ? 0 : Math.fround(sampler.sampleUniform(4)),
    bounceHeight: sampler.getIsChance(40) ? 0 : Math.fround(sampler.sampleUniform(2)),
    flipHeight: sampler.getIsChance(60) ? 0 : Math.fround(sampler.sampleUniform(2)),
    twoPointHeight: sampler.getIsChance(50) ? 0 : Math.fround(sampler.sampleUniform(6)),
    twoPointTilt: sampler.getIsChance(60) ? 0 : Math.fround(sampler.sampleUniform(0.6)),
    flags: sampleChoice(sampler, 0, 0x8),
    rotation: Array.from({ length: 9 }, () => Math.fround(sampler.sampleUniform(1))),
    position: sampler.sampleList(3, 300).map(Math.fround),
    physicsRotation: Array.from({ length: 9 }, () => Math.fround(sampler.sampleUniform(1))),
    localCentreOfMass: sampler.sampleList(3, 3).map(Math.fround),
    localInverseInertia: Array.from({ length: 9 }, () => Math.fround(sampler.sampleUniform(3))),
    localWheelAnchor: sampler.sampleList(3, 3).map(Math.fround),
  }
}

const getSampleWords = (sample: ComputerRacerRouteSample): readonly number[] => {
  const { bytes } = sample
  const getWord = (start: number): number =>
    ((bytes[start + 3] ?? 0) << 24) |
    ((bytes[start + 2] ?? 0) << 16) |
    ((bytes[start + 1] ?? 0) << 8) |
    (bytes[start] ?? 0)
  return [
    ((sample.second & 0xffff) << 16) | (sample.first & 0xffff),
    getWord(0) >>> 0,
    getWord(4) >>> 0,
  ]
}

const getFollowerWords = (follower: RouteFollower): readonly EmulatorArgument[] => {
  const words = new Array<EmulatorArgument>(FOLLOWER_WORDS).fill(0)
  const setFloats = (word: number, values: readonly number[]): void =>
    values.forEach((value, index) => {
      words[word + index] = getBitsFromFloat(value)
    })
  const vector = (value: Vector3): readonly number[] => [value.x, value.y, value.z]
  const quaternion = (value: RouteFollower['rotation']): readonly number[] => [
    value.x,
    value.y,
    value.z,
    value.w,
  ]
  setFloats(0, vector(follower.position))
  setFloats(3, quaternion(follower.rotation))
  words[7] = follower.contactState
  setFloats(8, [follower.negativeLateralLimit, follower.positiveLateralLimit])
  words[10] = { buffer: 'route' }
  setFloats(11, [follower.speedFactor, follower.time])
  words[13] = follower.previousSampleIndex >>> 0
  words[14] = follower.nextSampleIndex
  setFloats(15, vector(follower.previousPosition))
  setFloats(18, vector(follower.nextPosition))
  setFloats(21, quaternion(follower.previousRotation))
  setFloats(25, quaternion(follower.nextRotation))
  words[29] = follower.previousTime
  return words
}

const getBodyWords = (item: ScriptedCase): readonly EmulatorArgument[] => {
  const words = new Array<EmulatorArgument>(BODY_WORDS).fill(0)
  const setFloats = (offset: number, values: readonly number[]): void =>
    values.forEach((value, index) => {
      words[offset / 4 + index] = getBitsFromFloat(value)
    })
  words[0] = CAR_BODY_VTABLE
  words[At.physicsFrame / 4] = { buffer: 'physicsFrame' }
  words[At.displayFrame / 4] = { buffer: 'frame' }
  words[At.flags / 4] = item.flags
  words[At.isScripted / 4] = 1
  setFloats(At.localCentreOfMass, item.localCentreOfMass)
  setFloats(At.localInverseInertia, item.localInverseInertia)
  setFloats(At.localWheelAnchor, item.localWheelAnchor)
  setFloats(At.twoPointHeight, [item.twoPointHeight])
  setFloats(At.twoPointTilt, [item.twoPointTilt])
  setFloats(At.flipHeight, [item.flipHeight])
  setFloats(At.bounceHeight, [item.bounceHeight, item.lateralOffset])
  getFollowerWords(item.follower).forEach((word, index) => {
    words[At.follower / 4 + index] = word
  })
  words[0x768 / 4] = item.follower.contactState
  return words
}

const getFrameWords = (
  rotation: readonly number[],
  position: readonly number[]
): readonly EmulatorArgument[] => {
  const words = new Array<EmulatorArgument>(FRAME_WORDS).fill(0)
  words[0] = FRAME_VTABLE
  rotation.forEach((value, index) => {
    words[FRAME_ROTATION / 4 + index] = getBitsFromFloat(value)
  })
  position.forEach((value, index) => {
    words[FRAME_POSITION / 4 + index] = getBitsFromFloat(value)
  })
  return words
}

const getCall = (
  precision: EmulatorPrecision,
  item: ScriptedCase,
  address: number
): EmulatorCall => ({
  address,
  convention: 'thiscall',
  precision,
  arguments:
    address === SEPARATE_ADDRESS
      ? [{ buffer: 'body' }, { buffer: 'displacement' }]
      : [{ buffer: 'body' }],
  buffers: [
    { name: 'body', words: getBodyWords(item), isRead: true },
    { name: 'frame', words: getFrameWords(item.rotation, item.position), isRead: true },
    { name: 'physicsFrame', words: getFrameWords(item.physicsRotation, [0, 0, 0]), isRead: false },
    {
      name: 'route',
      words: [
        item.route.samples.length,
        { buffer: 'samples' },
        ...new Array<number>(3).fill(0),
        ...[...item.route.firstQuaternion].map(getBitsFromFloat),
        ...item.route.secondVector.map(getBitsFromFloat),
        ...item.route.secondQuaternion.map(getBitsFromFloat),
        item.route.firstInteger,
        item.route.sampleIndex,
      ],
      isRead: false,
    },
    { name: 'samples', words: item.route.samples.flatMap(getSampleWords), isRead: false },
    {
      name: 'displacement',
      words: [item.displacement.x, item.displacement.y, item.displacement.z].map(getBitsFromFloat),
      isRead: false,
    },
  ],
})

const getPortBody = (item: ScriptedCase): CarBody => {
  const body = createCarBody(createFixtureRacerDefinition(2).carBody)
  const toVector = (values: readonly number[]): Vector3 => ({
    x: values[0] ?? 0,
    y: values[1] ?? 0,
    z: values[2] ?? 0,
  })
  return Object.freeze({
    ...body,
    isScripted: true,
    routeFollower: item.follower,
    lateralOffset: item.lateralOffset,
    bounceHeight: item.bounceHeight,
    flipHeight: item.flipHeight,
    rigidBody: Object.freeze({
      ...body.rigidBody,
      flags: item.flags,
      twoPointHeight: item.twoPointHeight,
      twoPointTilt: item.twoPointTilt,
      pitchTimer: 0,
      yawTimer: 0,
      localCentreOfMass: toVector(item.localCentreOfMass),
      localInverseInertia: Object.freeze([...item.localInverseInertia]) as never,
      localWheelAnchor: toVector(item.localWheelAnchor),
      wheels: body.rigidBody.wheels.map((wheel) =>
        Object.freeze({ ...wheel, anchor: { x: 0, y: 0, z: 0 } })
      ),
      frame: Object.freeze({
        rotation: Object.freeze([...item.physicsRotation]) as never,
        position: { x: 0, y: 0, z: 0 },
      }),
      displayFrame: Object.freeze({
        rotation: Object.freeze([...item.rotation]) as never,
        position: toVector(item.position),
      }),
    }),
  })
}

const getOriginalBits = (body: readonly number[], frame: readonly number[]): readonly number[] => [
  ...Array.from({ length: 9 }, (_, index) => frame[FRAME_ROTATION / 4 + index] ?? 0),
  ...Array.from({ length: 3 }, (_, index) => frame[FRAME_POSITION / 4 + index] ?? 0),
  ...Array.from({ length: 3 }, (_, index) => body[At.worldCentreOfMass / 4 + index] ?? 0),
  ...Array.from({ length: 3 }, (_, index) => body[At.heading / 4 + index] ?? 0),
  ...Array.from({ length: 9 }, (_, index) => body[At.worldInverseInertia / 4 + index] ?? 0),
  body[At.groundedWheelCount / 4] ?? 0,
  body[At.lateralOffset / 4] ?? 0,
  ...Array.from({ length: FOLLOWER_WORDS }, (_, index) =>
    index === 10 ? 0 : (body[At.follower / 4 + index] ?? 0)
  ),
]

const getPortBits = (body: CarBody): readonly number[] => {
  const { rigidBody, routeFollower } = body
  const { rotation, position } = rigidBody.displayFrame
  const followerBits = (routeFollower === null ? [] : getFollowerWords(routeFollower)).map(
    (word, index) => (index === 10 || typeof word !== 'number' ? 0 : word >>> 0)
  )
  return [
    ...rotation.map(getBitsFromFloat),
    getBitsFromFloat(position.x),
    getBitsFromFloat(position.y),
    getBitsFromFloat(position.z),
    getBitsFromFloat(rigidBody.worldCentreOfMass.x),
    getBitsFromFloat(rigidBody.worldCentreOfMass.y),
    getBitsFromFloat(rigidBody.worldCentreOfMass.z),
    getBitsFromFloat(rigidBody.heading.x),
    getBitsFromFloat(rigidBody.heading.y),
    getBitsFromFloat(rigidBody.heading.z),
    ...rigidBody.worldInverseInertia.map(getBitsFromFloat),
    rigidBody.groundedWheelCount,
    getBitsFromFloat(body.lateralOffset),
    ...followerBits,
  ].map((bits) => bits >>> 0)
}

const expectMatchesOriginal = async (
  precision: EmulatorPrecision,
  address: number,
  getPortResult: (
    arithmetic: ReturnType<typeof createFloatArithmetic>,
    item: ScriptedCase
  ) => CarBody
): Promise<void> => {
  // Arrange
  const arithmetic = createFloatArithmetic(precision)
  const sampler = createFloatSampler(createSeededRandom(address + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleScriptedCase(sampler, arithmetic))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getCall(precision, item, address)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const original = getOriginalBits(
      results[index]?.buffers['body'] ?? [],
      results[index]?.buffers['frame'] ?? []
    )
    const ported = getPortBits(getPortResult(arithmetic, item))
    const differing = original.flatMap((bits, position) =>
      getIsSameFloatBits(bits, ported[position] ?? 0) ? [] : [position]
    )
    return differing.length === 0 ? [] : [`${String(index)}: outputs ${differing.join()}`]
  })

  // Assert
  expect(mismatches.slice(0, 8)).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('the scripted car body against the original', () => {
  it.each(PRECISIONS)(
    '0x0042a570 matches the original bit for bit in %s precision',
    (precision) =>
      expectMatchesOriginal(precision, PLACE_ADDRESS, (arithmetic, item) => {
        const body = getPortBody(item)
        return Object.freeze({
          ...body,
          rigidBody: getBodyAtFollower(
            arithmetic,
            body,
            item.follower,
            item.lateralOffset,
            item.bounceHeight
          ),
        })
      }),
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it.each(PRECISIONS)(
    '0x00429680 matches the original bit for bit in %s precision',
    (precision) =>
      expectMatchesOriginal(precision, SEPARATE_ADDRESS, (arithmetic, item) =>
        getScriptedBodySeparated(arithmetic, getPortBody(item), item.displacement)
      ),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
})

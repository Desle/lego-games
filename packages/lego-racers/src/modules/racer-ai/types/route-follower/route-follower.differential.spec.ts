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
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { RouteFollower } from '../racer-ai.types.ts'
import { getRouteSampleOffset } from '../route-sample/route-sample.ts'
import { createRouteFollower, moveRouteFollower } from './route-follower.ts'

const MOVE_ADDRESS = 0x004a5750
const CASE_COUNT = 1500
const FOLLOWER_WORDS = 30
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

type MoveCase = {
  readonly route: ComputerRacerRoute
  readonly follower: RouteFollower
  readonly displacement: Vector3
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

const sampleCase = (
  sampler: FloatSampler,
  arithmetic: ReturnType<typeof createFloatArithmetic>
): MoveCase => {
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
    previousSampleIndex,
    nextSampleIndex,
    previousPosition,
    nextPosition,
    previousTime: 32 * sampler.sampleIntegerBelow(40),
    time: Math.fround(sampler.sampleUniform(1000)),
  }
  const isZero = sampler.getIsChance(60)
  return {
    route,
    follower,
    displacement: isZero
      ? { x: 0, y: 0, z: 0 }
      : sampleVector(sampler, sampleChoice(sampler, 1, 5, 50)),
  }
}

const getSampleWords = (sample: ComputerRacerRouteSample): readonly number[] => {
  const bytes = sample.bytes
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

const getPortWords = (follower: RouteFollower): readonly number[] =>
  getFollowerWords(follower).map((word) => (typeof word === 'number' ? word >>> 0 : 0))

const getEmulatorCall = (precision: EmulatorPrecision, item: MoveCase): EmulatorCall => ({
  address: MOVE_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'follower' }, { buffer: 'displacement' }],
  buffers: [
    { name: 'follower', words: getFollowerWords(item.follower), isRead: true },
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
      isRead: true,
    },
  ],
})

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const arithmetic = createFloatArithmetic(precision)
  const sampler = createFloatSampler(createSeededRandom(0x4a5750 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleCase(sampler, arithmetic))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getEmulatorCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const moved = moveRouteFollower(arithmetic, item.follower, item.displacement)
    const original = results[index]?.buffers['follower'] ?? []
    const originalDisplacement = results[index]?.buffers['displacement'] ?? []
    const portWords = getPortWords(moved.follower)
    const portDisplacement = [moved.displacement.x, moved.displacement.y, moved.displacement.z].map(
      getBitsFromFloat
    )
    const isSame =
      portWords.every((word, wordIndex) =>
        wordIndex === 10 ? true : getIsSameFloatBits(original[wordIndex] ?? 0, word)
      ) &&
      portDisplacement.every((word, wordIndex) =>
        getIsSameFloatBits(originalDisplacement[wordIndex] ?? 0, word)
      )
    return isSame ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('the route follower move against the original', () =>
  it.each(PRECISIONS)(
    '0x004a5750 matches the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

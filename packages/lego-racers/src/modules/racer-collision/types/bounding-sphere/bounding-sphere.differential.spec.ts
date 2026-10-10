import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat, getIsSameFloatBits } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Frame, Matrix3 } from '../../../simulation-math/index.ts'
import type { BoundingSphere } from '../racer-collision.types.ts'
import { getBoundingInterval, getBoundingSphere, getSpheresOverlap } from './bounding-sphere.ts'

const SPHERE_ADDRESS = 0x004113d0
const OVERLAP_ADDRESS = 0x00411b90
// The display frame's vtable (0x004af754): slot +0x2c is Frame_TransformPoint.
const FRAME_VTABLE_ADDRESS = 0x004af754
const FRAME_WORDS = 64
const CHILD_WORDS = 16
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const CENTRE_WORD = 1
const RADIUS_WORD = 4
const MINIMUM_WORD = 5
const MAXIMUM_WORD = 6
const ROTATION_WORD = 10
const POSITION_WORD = 19
const SCALE_WORD = 22
const CHILD_POINTER_WORD = 30
const CHILD_CENTRE_WORD = 10
const CHILD_RADIUS_WORD = 13

type SphereCase = {
  readonly frame: Frame
  readonly centre: readonly [number, number, number]
  readonly radius: number
}

const sampleRotation = (sampler: FloatSampler): Matrix3 => {
  const angle = sampler.sampleAngle(6.3)
  const [cosine, sine] = [Math.cos(angle), Math.sin(angle)]
  return [cosine, sine, 0, -sine, cosine, 0, 0, 0, 1].map(Math.fround) as unknown as Matrix3
}

const sampleCase = (sampler: FloatSampler): SphereCase => {
  const [x, y, z] = sampler.sampleList(3, 6).map(Math.fround) as [number, number, number]
  const centre = sampler.sampleList(3, 0.5).map(Math.fround) as [number, number, number]
  return {
    frame: { rotation: sampleRotation(sampler), position: { x, y, z } },
    centre,
    radius: Math.fround(1 + Math.abs(sampler.sampleUniform(2))),
  }
}

const getFrameWords = (
  item: SphereCase,
  radius: number
): readonly (number | { buffer: string })[] => {
  const words: (number | { buffer: string })[] = Array.from({ length: FRAME_WORDS }, () => 0)
  words[0] = FRAME_VTABLE_ADDRESS
  words[RADIUS_WORD] = getBitsFromFloat(radius)
  item.frame.rotation.forEach((value, index) => {
    words[ROTATION_WORD + index] = getBitsFromFloat(value)
  })
  words[POSITION_WORD] = getBitsFromFloat(item.frame.position.x)
  words[POSITION_WORD + 1] = getBitsFromFloat(item.frame.position.y)
  words[POSITION_WORD + 2] = getBitsFromFloat(item.frame.position.z)
  words[SCALE_WORD] = getBitsFromFloat(1)
  words[CHILD_POINTER_WORD] = { buffer: 'child' }
  words[CENTRE_WORD] = getBitsFromFloat(item.centre[0])
  words[CENTRE_WORD + 1] = getBitsFromFloat(item.centre[1])
  words[CENTRE_WORD + 2] = getBitsFromFloat(item.centre[2])
  return words
}

const getChildWords = (item: SphereCase): readonly number[] => {
  const words = Array.from({ length: CHILD_WORDS }, () => 0)
  item.centre.forEach((value, index) => {
    words[CHILD_CENTRE_WORD + index] = getBitsFromFloat(value)
  })
  words[CHILD_RADIUS_WORD] = getBitsFromFloat(item.radius)
  return words
}

const getWorldSphere = (arithmetic: FloatArithmetic, item: SphereCase): BoundingSphere =>
  getBoundingSphere(
    arithmetic,
    item.frame,
    { x: item.centre[0], y: item.centre[1], z: item.centre[2] },
    item.radius
  )

const getWorldSphereWords = (
  arithmetic: FloatArithmetic,
  item: SphereCase
): readonly (number | { buffer: string })[] => {
  const sphere = getWorldSphere(arithmetic, item)
  const words = getFrameWords(item, sphere.radius)
  return words.map((word, index) => {
    if (index === CENTRE_WORD) return getBitsFromFloat(sphere.centre.x)
    if (index === CENTRE_WORD + 1) return getBitsFromFloat(sphere.centre.y)
    if (index === CENTRE_WORD + 2) return getBitsFromFloat(sphere.centre.z)
    return word
  })
}

const getSphereCall = (precision: EmulatorPrecision, item: SphereCase): EmulatorCall => ({
  address: SPHERE_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'frame' }, 0],
  buffers: [
    { name: 'frame', words: getFrameWords(item, -1), isRead: true },
    { name: 'child', words: getChildWords(item), isRead: false },
  ],
})

const getOverlapCall = (
  precision: EmulatorPrecision,
  first: SphereCase,
  second: SphereCase,
  arithmetic: FloatArithmetic
): EmulatorCall => ({
  address: OVERLAP_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'first' }, { buffer: 'second' }],
  buffers: [
    { name: 'first', words: getWorldSphereWords(arithmetic, first), isRead: false },
    { name: 'second', words: getWorldSphereWords(arithmetic, second), isRead: false },
    { name: 'child', words: getChildWords(first), isRead: false },
  ],
})

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x4113 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => ({
    first: sampleCase(sampler),
    second: sampleCase(sampler),
  }))
  const arithmetic = createFloatArithmetic(precision)
  const session = openEmulatorSession()

  // Act
  const sphereResults = await session.callBatch(
    cases.map(({ first }) => getSphereCall(precision, first))
  )
  const overlapResults = await session.callBatch(
    cases.map(({ first, second }) => getOverlapCall(precision, first, second, arithmetic))
  )
  await session.close()
  const mismatches = cases.flatMap(({ first, second }, index) => {
    const sphere = getWorldSphere(arithmetic, first)
    const interval = getBoundingInterval(arithmetic, sphere)
    const original = sphereResults[index]?.buffers['frame'] ?? []
    const portWords = [
      sphere.centre.x,
      sphere.centre.y,
      sphere.centre.z,
      sphere.radius,
      interval.minimum,
      interval.maximum,
    ].map(getBitsFromFloat)
    const originalWords = [
      ...original.slice(CENTRE_WORD, CENTRE_WORD + 3),
      original[RADIUS_WORD] ?? 0,
      original[MINIMUM_WORD] ?? 0,
      original[MAXIMUM_WORD] ?? 0,
    ]
    const isSphereSame = originalWords.every((bits, word) =>
      getIsSameFloatBits(bits, portWords[word] ?? 0)
    )
    const isOverlapping = getSpheresOverlap(arithmetic, sphere, getWorldSphere(arithmetic, second))
    const isOverlapSame = (overlapResults[index]?.eax === 1) === isOverlapping
    return isSphereSame && isOverlapSame ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('bounding sphere against the original', () =>
  it.each(PRECISIONS)(
    '0x004113d0 and 0x00411b90 match the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

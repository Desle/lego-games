import { getBitsFromFloat, getIsSameFloatBits } from '../../../../shared/emulator/float-bits.ts'
import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import type { OrientedBox } from '../racer-collision.types.ts'
import { getBoxContact, getBoxOverlap } from './oriented-box.ts'

const SEPARATING_AXIS_ADDRESS = 0x00441790
const CONTACT_ADDRESS = 0x00441330
// The frame's vtable (0x004af754): slot +0x44 copies the rotation.
const FRAME_VTABLE_ADDRESS = 0x004af754
const BODY_WORDS = 56
const FRAME_WORDS = 24
const FRAME_ROTATION_WORD = 10
const BODY_CENTRE_WORD = 8
const BODY_DIMENSIONS_WORD = 52
const BODY_SCALE_WORD = 55
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

// Rotation of a car: a turn about z, a small tilt, and now and then an arbitrary rotation.
const sampleRotation = (sampler: FloatSampler): Matrix3 => {
  const angle = sampler.sampleAngle(6.3)
  const tilt = sampler.sampleUniform(0.3)
  const [cosine, sine] = [Math.cos(angle), Math.sin(angle)]
  const [tiltCosine, tiltSine] = [Math.cos(tilt), Math.sin(tilt)]
  return [
    cosine,
    sine,
    0,
    -sine * tiltCosine,
    cosine * tiltCosine,
    tiltSine,
    sine * tiltSine,
    -cosine * tiltSine,
    tiltCosine,
  ].map(Math.fround) as unknown as Matrix3
}

const sampleBox = (sampler: FloatSampler, spread: number): OrientedBox => {
  const [x, y, z] = sampler.sampleList(3, spread).map(Math.fround) as [number, number, number]
  const [width, length, height] = sampler.sampleList(3, 1) as [number, number, number]
  return {
    rotation: sampleRotation(sampler),
    centre: { x, y, z },
    dimensions: {
      x: Math.fround(1 + Math.abs(width)),
      y: Math.fround(2 + Math.abs(length)),
      z: Math.fround(0.5 + Math.abs(height)),
    },
    scale: sampler.getIsChance(25) ? Math.fround(0.5 + Math.abs(sampler.sampleUniform(0.5))) : 1,
  }
}

const getBodyWords = (
  box: OrientedBox,
  frameName: string
): readonly (number | { buffer: string })[] => {
  const words: (number | { buffer: string })[] = Array.from({ length: BODY_WORDS }, () => 0)
  words[1] = { buffer: frameName }
  words[BODY_CENTRE_WORD] = getBitsFromFloat(box.centre.x)
  words[BODY_CENTRE_WORD + 1] = getBitsFromFloat(box.centre.y)
  words[BODY_CENTRE_WORD + 2] = getBitsFromFloat(box.centre.z)
  words[BODY_DIMENSIONS_WORD] = getBitsFromFloat(box.dimensions.x)
  words[BODY_DIMENSIONS_WORD + 1] = getBitsFromFloat(box.dimensions.y)
  words[BODY_DIMENSIONS_WORD + 2] = getBitsFromFloat(box.dimensions.z)
  words[BODY_SCALE_WORD] = getBitsFromFloat(box.scale)
  return words
}

const getFrameWords = (box: OrientedBox): readonly number[] => {
  const words = Array.from({ length: FRAME_WORDS }, () => 0)
  words[0] = FRAME_VTABLE_ADDRESS
  box.rotation.forEach((value, index) => {
    words[FRAME_ROTATION_WORD + index] = getBitsFromFloat(value)
  })
  return words
}

const getCall = (
  address: number,
  precision: EmulatorPrecision,
  first: OrientedBox,
  second: OrientedBox,
  isContact: boolean
): EmulatorCall => ({
  address,
  convention: 'thiscall',
  precision,
  // thiscall: the first box in ECX; the stack holds the second box and the output pointers.
  arguments: [
    { buffer: 'first' },
    { buffer: 'second' },
    { buffer: 'results', offset: 0 },
    { buffer: 'results', offset: 4 },
    ...(isContact
      ? [{ buffer: 'results', offset: 16 }]
      : [
          { buffer: 'results', offset: 16 },
          { buffer: 'results', offset: 20 },
        ]),
  ],
  buffers: [
    { name: 'first', words: getBodyWords(first, 'firstFrame'), isRead: false },
    { name: 'second', words: getBodyWords(second, 'secondFrame'), isRead: false },
    { name: 'firstFrame', words: getFrameWords(first), isRead: false },
    { name: 'secondFrame', words: getFrameWords(second), isRead: false },
    { name: 'results', size: 64, isRead: true },
  ],
})

const getFloats = (words: readonly number[] | undefined, start: number, count: number) =>
  (words ?? []).slice(start, start + count)

const getIsSameBits = (original: readonly number[], port: readonly number[]): boolean =>
  original.length === port.length &&
  original.every((bits, index) => getIsSameFloatBits(bits, port[index] ?? 0))

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x4411 + precision.length))
  const boxes = Array.from({ length: CASE_COUNT }, () => ({
    first: sampleBox(sampler, 0.5),
    second: sampleBox(sampler, 4),
  }))
  const arithmetic = createFloatArithmetic(precision)
  const session = openEmulatorSession()

  // Act
  const overlapResults = await session.callBatch(
    boxes.map(({ first, second }) =>
      getCall(SEPARATING_AXIS_ADDRESS, precision, first, second, false)
    )
  )
  const contactResults = await session.callBatch(
    boxes.map(({ first, second }) => getCall(CONTACT_ADDRESS, precision, first, second, true))
  )
  await session.close()
  const mismatches = boxes.flatMap(({ first, second }, index) => {
    const overlap = getBoxOverlap(arithmetic, first, second)
    const contact = getBoxContact(arithmetic, first, second)
    const originalOverlap = overlapResults[index]
    const originalContact = contactResults[index]
    const overlapWords = originalOverlap?.buffers['results']
    const contactWords = originalContact?.buffers['results']
    const isOverlapSame =
      (originalOverlap?.eax === 1) === (overlap !== undefined) &&
      (overlap === undefined ||
        (getIsSameBits(getFloats(overlapWords, 0, 4), [
          getBitsFromFloat(overlap.depth),
          getBitsFromFloat(overlap.normal.x),
          getBitsFromFloat(overlap.normal.y),
          getBitsFromFloat(overlap.normal.z),
        ]) &&
          getIsSameBits(getFloats(overlapWords, 4, 2), [
            getBitsFromFloat(overlap.firstReach),
            getBitsFromFloat(overlap.secondReach),
          ])))
    const isContactSame =
      (originalContact?.eax === 1) === (contact !== undefined) &&
      (contact === undefined ||
        getIsSameBits(
          [...getFloats(contactWords, 0, 4), ...getFloats(contactWords, 4, 3)],
          [
            getBitsFromFloat(contact.depth),
            getBitsFromFloat(contact.normal.x),
            getBitsFromFloat(contact.normal.y),
            getBitsFromFloat(contact.normal.z),
            getBitsFromFloat(contact.point.x),
            getBitsFromFloat(contact.point.y),
            getBitsFromFloat(contact.point.z),
          ]
        ))
    return isOverlapSame && isContactSame ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
  expect(overlapResults.filter((result) => result.eax === 1).length).toBeGreaterThan(100)
}

describe.skipIf(!getIsEmulatorAvailable())('oriented box collision against the original', () =>
  it.each(PRECISIONS)(
    '0x00441790 and 0x00441330 match the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

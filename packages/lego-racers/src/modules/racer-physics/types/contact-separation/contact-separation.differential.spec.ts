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
import { createFloatArithmetic, IDENTITY_MATRIX3 } from '../../../simulation-math/index.ts'
import { createCarRigidBody } from '../car-rigid-body/car-rigid-body.ts'
import { moveOutOfContact } from './contact-separation.ts'

// The car body's separation (slot-less call 0x00429680 on a free body) runs 0x004490b0.
const SEPARATION_ADDRESS = 0x00429680
const CAR_BODY_VTABLE = 0x004b04e4
const FRAME_VTABLE = 0x004af700
const DISPLAY_FRAME_VTABLE = 0x004af754
const BODY_WORDS = 0x888 / 4
const CASE_COUNT = 400
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 60_000
const WITHOUT_TRACK_FLAG = 0x1000

type Entry = readonly [number, EmulatorArgument]

type SeparationCase = {
  readonly displayPosition: readonly number[]
  readonly framePosition: readonly number[]
  readonly displacement: readonly number[]
}

const buildWords = (length: number, entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getFloatEntries = (word: number, values: readonly number[]): readonly Entry[] =>
  values.map((value, index): Entry => [word + index, getBitsFromFloat(value)])

const sampleVector = (sampler: FloatSampler, limit: number): readonly number[] =>
  Array.from({ length: 3 }, () => sampler.sampleUniform(limit))

const getCall = (precision: EmulatorPrecision, item: SeparationCase): EmulatorCall => ({
  address: SEPARATION_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'body' }, { buffer: 'displacement' }],
  buffers: [
    {
      name: 'body',
      words: buildWords(BODY_WORDS, [
        [0, CAR_BODY_VTABLE],
        [0xe4 / 4, FRAME_VTABLE],
        ...getFloatEntries(0x10c / 4, IDENTITY_MATRIX3),
        ...getFloatEntries(0x130 / 4, item.framePosition),
        [0x13c / 4, { buffer: 'display' }],
        [0x6c0 / 4, WITHOUT_TRACK_FLAG],
      ]),
      isRead: true,
    },
    {
      name: 'display',
      words: buildWords(32, [
        [0, DISPLAY_FRAME_VTABLE],
        ...getFloatEntries(10, IDENTITY_MATRIX3),
        ...getFloatEntries(0x4c / 4, item.displayPosition),
      ]),
      isRead: true,
    },
    {
      name: 'displacement',
      words: getFloatEntries(0, item.displacement).map(([, bits]) => bits),
      isRead: false,
    },
  ],
})

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x4490 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => ({
    displayPosition: sampleVector(sampler, 50),
    framePosition: sampleVector(sampler, 50),
    displacement: sampleVector(sampler, 2),
  }))
  const arithmetic = createFloatArithmetic(precision)
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const [dx, dy, dz] = item.displayPosition as [number, number, number]
    const [fx, fy, fz] = item.framePosition as [number, number, number]
    const [mx, my, mz] = item.displacement as [number, number, number]
    const base = createCarRigidBody(arithmetic, {
      displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: dx, y: dy, z: dz } },
      displayBoundingRadius: 1,
      mass: 2,
      dimensions: { x: 1, y: 1, z: 1 },
    })
    const moved = moveOutOfContact(
      arithmetic,
      {
        ...base,
        frame: { rotation: IDENTITY_MATRIX3, position: { x: fx, y: fy, z: fz } },
        flags: WITHOUT_TRACK_FLAG,
      },
      { x: mx, y: my, z: mz },
      []
    )
    const original = results[index]
    const originalPositions = [
      ...(original?.buffers['display']?.slice(0x4c / 4, 0x4c / 4 + 3) ?? []),
      ...(original?.buffers['body']?.slice(0x130 / 4, 0x130 / 4 + 3) ?? []),
    ]
    const portPositions = [
      moved.displayFrame.position.x,
      moved.displayFrame.position.y,
      moved.displayFrame.position.z,
      moved.frame.position.x,
      moved.frame.position.y,
      moved.frame.position.z,
    ].map(getBitsFromFloat)
    const isSame = originalPositions.every((bits, word) =>
      getIsSameFloatBits(bits, portPositions[word] ?? 0)
    )
    return isSame ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('contact separation against the original', () =>
  it.each(PRECISIONS)(
    '0x004490b0 matches the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

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
import {
  createFloatArithmetic,
  getRotationFromFirstAndSecondAxes,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import { getVehicleLean } from './vehicle-lean.ts'

const VEHICLE_ADDRESS = 0x0043e740
const FIGURE_VTABLE = 0x004af5ec
const FRAME_VTABLE = 0x004af754
const WORD_COUNT = 256
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

type Entry = readonly [number, EmulatorArgument]

type LeanCase = {
  readonly displayRotation: Matrix3
  readonly displayPosition: Vector3
  readonly bodyRotation: Matrix3
  readonly forwardLean: number
  readonly sideLean: number
  readonly step: number
  readonly mass: number
  readonly seatPoint: Vector3
}

const buildWords = (entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length: WORD_COUNT }, (_, index) => lookup.get(index) ?? 0)
}

const getFloatEntries = (word: number, values: readonly number[]): readonly Entry[] =>
  values.map((value, index): Entry => [word + index, getBitsFromFloat(value)])

const sampleVector = (sampler: FloatSampler, limit: number): Vector3 => ({
  x: sampler.sampleUniform(limit),
  y: sampler.sampleUniform(limit),
  z: sampler.sampleUniform(limit),
})

const sampleRotation = (sampler: FloatSampler): Matrix3 =>
  getRotationFromFirstAndSecondAxes(
    createFloatArithmetic('double'),
    sampleVector(sampler, 1),
    sampleVector(sampler, 1)
  ).map(Math.fround) as unknown as Matrix3

const sampleCase = (sampler: FloatSampler): LeanCase => {
  const displayRotation = sampleRotation(sampler)
  const isNearby = sampler.getIsChance(60)
  return {
    displayRotation,
    displayPosition: sampleVector(sampler, 300),
    bodyRotation: isNearby ? displayRotation : sampleRotation(sampler),
    forwardLean: sampler.getIsChance(30) ? 0 : sampler.sampleUniform(0.3),
    sideLean: sampler.getIsChance(30) ? 0 : sampler.sampleUniform(0.3),
    step: [1, 8, 16, 33, 40, 100][sampler.sampleIntegerBelow(6)] ?? 16,
    mass: sampler.getIsChance(50) ? 2500 : 4500,
    seatPoint: sampleVector(sampler, 4),
  }
}

const getFrameEntries = (rotation: readonly number[], position: Vector3): readonly Entry[] => [
  ...getFloatEntries(0x28 / 4, rotation),
  ...getFloatEntries(0x4c / 4, [position.x, position.y, position.z]),
]

const getCall = (precision: EmulatorPrecision, item: LeanCase): EmulatorCall => ({
  address: VEHICLE_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'vehicle' }, item.step],
  buffers: [
    {
      name: 'vehicle',
      words: buildWords([
        [0x3c / 4, { buffer: 'body' }],
        [0x44 / 4, { buffer: 'display' }],
        [0x48 / 4, { buffer: 'driver' }],
        ...getFloatEntries(0x4c / 4, [item.seatPoint.x, item.seatPoint.y, item.seatPoint.z]),
        [0x1dc / 4, { buffer: 'carBody' }],
        ...getFloatEntries(0x398 / 4, [item.forwardLean, item.sideLean]),
      ]),
      isRead: true,
    },
    {
      name: 'display',
      words: buildWords([
        [0, FIGURE_VTABLE],
        ...getFrameEntries(item.displayRotation, item.displayPosition),
      ]),
      isRead: false,
    },
    {
      name: 'body',
      words: buildWords([
        [0, FRAME_VTABLE],
        ...getFrameEntries(item.bodyRotation, { x: 0, y: 0, z: 0 }),
      ]),
      isRead: true,
    },
    {
      name: 'driver',
      words: buildWords([[0, FRAME_VTABLE]]),
      isRead: true,
    },
    {
      name: 'carBody',
      words: buildWords(getFloatEntries(0xc8 / 4, [item.mass])),
      isRead: false,
    },
  ],
})

const getWords = (value: readonly number[], start: number, count: number): readonly number[] =>
  value.slice(start, start + count)

const getPortOutput = (arithmetic: FloatArithmetic, item: LeanCase): readonly number[] => {
  const lean = getVehicleLean({
    arithmetic,
    displayFrame: { rotation: item.displayRotation, position: item.displayPosition },
    bodyRotation: item.bodyRotation,
    forwardLean: item.forwardLean,
    sideLean: item.sideLean,
    stepMilliseconds: item.step,
    mass: item.mass,
    seatPoint: item.seatPoint,
  })
  const { x, y, z } = item.displayPosition
  return [
    lean.forwardLean,
    lean.sideLean,
    ...lean.bodyRotation,
    x,
    y,
    z,
    ...lean.bodyRotation,
    lean.driverPosition.x,
    lean.driverPosition.y,
    lean.driverPosition.z,
  ].map(getBitsFromFloat)
}

const getOriginalOutput = (
  buffers: Readonly<Record<string, readonly number[]>>
): readonly number[] => {
  const vehicle = buffers['vehicle'] ?? []
  const body = buffers['body'] ?? []
  const driver = buffers['driver'] ?? []
  return [
    ...getWords(vehicle, 0x398 / 4, 2),
    ...getWords(body, 0x28 / 4, 9),
    ...getWords(body, 0x4c / 4, 3),
    ...getWords(driver, 0x28 / 4, 9),
    ...getWords(driver, 0x4c / 4, 3),
  ]
}

const getIsSameWords = (original: readonly number[], port: readonly number[]): boolean =>
  original.length === port.length &&
  original.every((bits, index) => getIsSameFloatBits(bits, port[index] ?? 0))

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x43e740 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleCase(sampler))
  const arithmetic = createFloatArithmetic(precision)
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getCall(precision, item)))
  await session.close()

  // Assert
  const mismatches = cases.flatMap((item, index) =>
    getIsSameWords(
      getOriginalOutput(results[index]?.buffers ?? {}),
      getPortOutput(arithmetic, item)
    )
      ? []
      : [index]
  )
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('the vehicle lean against the original', () =>
  it.each(PRECISIONS)(
    '0x0043e740 matches the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

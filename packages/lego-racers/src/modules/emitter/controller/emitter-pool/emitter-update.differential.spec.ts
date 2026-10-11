import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { readOriginalExecutable } from '../../../../shared/testing/original-files.ts'
import { loadRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import type { EmitterPool } from '../../types/emitter-pool.types.ts'
import type { Emitter } from '../../types/emitter.types.ts'
import { createIdleEmitterSystem } from '../emitter-system/emitter-system.ts'
import { updateEmitterPool } from './emitter-pool.ts'

// Emitter_Step 0x004897e0 (thiscall: ECX the emitter instance, one stack argument, the milliseconds).
const STEP_ADDRESS = 0x004897e0
// Particle birth 0x00412760 and the system's update 0x00412890 are replaced by recorders.
const BIRTH_ADDRESS = 0x00412760
const SYSTEM_UPDATE_ADDRESS = 0x00412890
const RANDOM_CURSOR_ADDRESS = 0x004c6ee4
const INSTANCE_WORDS = 0x300 / 4
const RECORD_WORD = 0x200 / 4
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

type StepCase = {
  readonly period: number
  readonly chance: number
  readonly points: readonly (readonly number[])[]
  readonly lifetime: number
  readonly lifeLimit: number
  readonly basis: readonly number[]
  readonly offset: readonly number[]
  readonly position: readonly number[]
  readonly since: number
  readonly age: number
  readonly milliseconds: number
  readonly cursor: number
}

type Entry = readonly [number, EmulatorArgument]

const buildWords = (length: number, entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getFloatEntries = (word: number, values: readonly number[]): readonly Entry[] =>
  values.map((value, index): Entry => [word + index, getBitsFromFloat(value)])

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleStep = (sampler: FloatSampler): StepCase => {
  const period = sampleChoice(sampler, 0, 16, 33, 100, 200)
  return {
    period,
    chance: sampleChoice(sampler, 0, 0, 40, 128, 255),
    points: Array.from({ length: 1 + sampler.sampleIntegerBelow(4) }, () =>
      Array.from({ length: 3 }, () => sampler.sampleUniform(20))
    ),
    lifetime: sampleChoice(sampler, 300, 700, 1200),
    lifeLimit: sampleChoice(sampler, -1, -1, -1, 0, 50, 1000),
    basis: Array.from({ length: 9 }, () => sampler.sampleUniform(2)),
    offset: Array.from({ length: 3 }, () => sampler.sampleUniform(5)),
    position: Array.from({ length: 3 }, () => sampler.sampleUniform(50)),
    since: sampler.sampleIntegerBelow(period + 40),
    age: sampler.sampleIntegerBelow(2000),
    milliseconds: sampleChoice(sampler, 1, 16, 33, 100),
    cursor: sampler.sampleIntegerBelow(1024),
  }
}

// mov edx,[eax+n]; mov [ecx+0x1f8+m],edx: the birth's velocity (second argument) and lifetime (third argument),
// then a marker, in the instance's spare words; ECX is the system, 8 bytes into the instance.
const BIRTH_RECORDER: readonly number[] = [
  0x8b, 0x44, 0x24, 0x08, 0x8b, 0x10, 0x89, 0x91, 0xf8, 0x01, 0, 0, 0x8b, 0x50, 0x04, 0x89, 0x91,
  0xfc, 0x01, 0, 0, 0x8b, 0x50, 0x08, 0x89, 0x91, 0x00, 0x02, 0, 0, 0x8b, 0x44, 0x24, 0x0c, 0x89,
  0x81, 0x04, 0x02, 0, 0, 0xc7, 0x81, 0x08, 0x02, 0, 0, 1, 0, 0, 0, 0xc2, 0x0c, 0,
]

const getEmulatorCall = (precision: EmulatorPrecision, item: StepCase): EmulatorCall => ({
  address: STEP_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'instance' }, item.milliseconds],
  buffers: [
    {
      name: 'instance',
      words: buildWords(INSTANCE_WORDS, [
        [0, { buffer: 'definition' }],
        ...getFloatEntries(0x148 / 4, item.offset),
        ...getFloatEntries(0x154 / 4, item.position),
        ...getFloatEntries(0x160 / 4, item.basis),
        [0x184 / 4, item.since],
        [0x188 / 4, item.age],
      ]),
      isRead: true,
    },
    {
      name: 'definition',
      words: buildWords(0x40 / 4, [
        [0, { buffer: 'points' }],
        [1, item.points.length],
        [0x14 / 4, item.period],
        [0x18 / 4, item.chance],
        [0x30 / 4, item.lifetime],
        [0x34 / 4, item.lifeLimit >>> 0],
      ]),
      isRead: false,
    },
    {
      name: 'points',
      words: item.points.flatMap((point) => point.map(getBitsFromFloat)),
      isRead: false,
    },
  ],
  patches: [
    { address: RANDOM_CURSOR_ADDRESS, bytes: [item.cursor & 255, item.cursor >> 8, 0, 0] },
    { address: BIRTH_ADDRESS, bytes: BIRTH_RECORDER },
    { address: SYSTEM_UPDATE_ADDRESS, bytes: [0xc2, 0x04, 0x00] },
  ],
  reads: [{ name: 'cursor', address: RANDOM_CURSOR_ADDRESS, count: 1 }],
})

const getEmitter = (item: StepCase): Emitter => ({
  name: 'test',
  firstTruncatedValue: item.period,
  secondTruncatedValue: item.chance,
  vector: [0, 0, 0],
  points: item.points.map((point) => [point[0] ?? 0, point[1] ?? 0, point[2] ?? 0] as const),
  firstFloat: 1,
  secondFloat: 1,
  thirdFloat: 0,
  fourthFloat: 0,
  fifthFloat: 1,
  entryIndex: null,
  firstInteger: item.lifetime,
  secondInteger: item.lifeLimit,
  thirdInteger: 0,
  linkedName: null,
})

const getPool = (item: StepCase): EmitterPool => {
  const [x, y, z] = item.position
  const [ox, oy, oz] = item.offset
  return {
    list: { emitters: [getEmitter(item)], readByteCount: 0 },
    instances: [
      {
        definitionIndex: 0,
        handleIndex: null,
        system: { ...createIdleEmitterSystem(), isActive: true },
        velocityOffset: { x: ox ?? 0, y: oy ?? 0, z: oz ?? 0 },
        position: { x: x ?? 0, y: y ?? 0, z: z ?? 0 },
        basis: item.basis as unknown as Matrix3,
        millisecondsSinceBirth: item.since,
        ageMilliseconds: item.age,
      },
    ],
    handles: [],
    animation: null,
  }
}

const getOriginalWords = (words: readonly number[]): readonly number[] => {
  const isBorn = (words[RECORD_WORD + 4] ?? 0) !== 0
  return [
    words[0] === 0 ? 0 : 1,
    words[0x184 / 4] ?? 0,
    words[0x188 / 4] ?? 0,
    isBorn ? 1 : 0,
    ...(isBorn ? [0, 1, 2, 3].map((offset) => words[RECORD_WORD + offset] ?? 0) : []),
  ]
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x4897 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => {
    const item = sampleStep(sampler)
    return {
      ...item,
      basis: item.basis.map(Math.fround),
      offset: item.offset.map(Math.fround),
      position: item.position.map(Math.fround),
      points: item.points.map((point) => point.map(Math.fround)),
    }
  })
  const table = loadRandomTable(readOriginalExecutable())
  const arithmetic = createFloatArithmetic(precision)
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getEmulatorCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const update = updateEmitterPool(
      arithmetic,
      getPool(item),
      { table, position: item.cursor },
      item.milliseconds
    )
    const [instance] = update.pool.instances
    const particle = instance?.system.particles[0]
    const ported = [
      instance?.definitionIndex === null ? 0 : 1,
      instance?.millisecondsSinceBirth ?? 0,
      instance?.ageMilliseconds ?? 0,
      ...(particle === undefined
        ? [0]
        : [
            1,
            getBitsFromFloat(particle.velocity.x),
            getBitsFromFloat(particle.velocity.y),
            getBitsFromFloat(particle.velocity.z),
            particle.lifetimeMilliseconds,
          ]),
    ]
    const original = results[index]
    const isSame =
      getOriginalWords(original?.buffers['instance'] ?? []).join() === ported.join() &&
      original?.buffers['cursor']?.[0] === update.position
    return isSame ? [] : [index]
  })
  const birthCount = results.filter(
    (result) => (result.buffers['instance']?.[RECORD_WORD + 4] ?? 0) !== 0
  ).length
  const releaseCount = results.filter((result) => result.buffers['instance']?.[0] === 0).length

  // Assert
  expect(mismatches).toEqual([])
  expect(birthCount).toBeGreaterThan(0)
  expect(releaseCount).toBeGreaterThan(0)
}

describe.skipIf(!getIsEmulatorAvailable())('the emitter step against the original', () =>
  it.each(PRECISIONS)(
    '0x004897e0 matches the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

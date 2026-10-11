import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat, getFloatFromBits } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { createTestCarBody } from '../racer-fixtures/racer-fixtures.ts'
import type { CarBody } from '../racer.types.ts'
import {
  addCarBodyImpulse,
  clearCarBodyTwoPointMode,
  setCarBodyPush,
  setCarBodyTwoPointMode,
  startCarBodyFlip,
  startCarBodySpin,
} from './car-body-commands.ts'

const CAR_BODY_VTABLE = 0x004b04e4
const FRAME_VTABLE = 0x004af700
const BODY_WORDS = 0x888 / 4
const CASE_COUNT = 600
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const FLOAT_OFFSETS: readonly number[] = [
  0x08, 0x0c, 0x10, 0xa4, 0xa8, 0xac, 0x630, 0x634, 0x638, 0x63c, 0x640, 0x644, 0x778, 0x7ec, 0x7e8,
  0x7d4, 0x7d8, 0x658, 0x65c, 0x660, 0x664, 0x668, 0x66c, 0x670, 0x674, 0x678, 0x67c, 0x680, 0x7dc,
  0x7e0,
]
const INTEGER_OFFSETS: readonly number[] = [0x6c0, 0x5e0, 0x5e8, 0x5e4, 0x5d8, 0x5dc]

// Slots 8, 9, 12, 13, 16, 17, 18 and 19 of the car body's vtable: 0x00429770, 0x00429c40, 0x00429b40, 0x00429bc0,
// 0x004298a0, 0x004298d0, 0x004298f0, 0x00429920; and the flip 0x00429cf0 they call.
const Command = Object.freeze({
  IMPULSE: { address: 0x00429770 },
  SPIN: { address: 0x00429c40 },
  PUSH_FIRST: { address: 0x004298a0 },
  RELEASE_FIRST: { address: 0x004298d0 },
  PUSH_SECOND: { address: 0x004298f0 },
  RELEASE_SECOND: { address: 0x00429920 },
  FLIP: { address: 0x00429cf0 },
  TWO_POINT_ON: { address: 0x00429b40 },
  TWO_POINT_OFF: { address: 0x00429bc0 },
})
type CommandName = keyof typeof Command
const COMMAND_NAMES = Object.keys(Command) as readonly CommandName[]

type Entry = readonly [number, EmulatorArgument]

type CommandCase = {
  readonly command: CommandName
  readonly isScripted: boolean
  readonly flags: number
  readonly heading: readonly number[]
  readonly speedFactor: number
  readonly defaultTarget: number
  readonly target: number
  readonly velocity: readonly number[]
  readonly momentum: readonly number[]
  readonly grounded: number
  readonly vector: readonly number[]
  readonly amount: number
  readonly arguments: readonly number[]
  readonly twoPoint: readonly number[]
  readonly timers: readonly number[]
  readonly wheelGeometry: readonly number[]
  readonly flip: readonly number[]
}

const buildWords = (length: number, entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getFloatEntries = (word: number, values: readonly number[]): readonly Entry[] =>
  values.map((value, index): Entry => [word + index, getBitsFromFloat(value)])

const sampleVector = (sampler: FloatSampler, limit: number): readonly number[] =>
  Array.from({ length: 3 }, () => sampler.sampleUniform(limit))

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleCase = (sampler: FloatSampler): CommandCase => {
  const heading = sampleVector(sampler, 1)
  const length = Math.hypot(...heading) || 1
  return {
    command: COMMAND_NAMES[sampler.sampleIntegerBelow(COMMAND_NAMES.length)] ?? 'IMPULSE',
    isScripted: sampler.getIsChance(60),
    flags: sampleChoice(sampler, 0, 0, 0x2, 0x20, 0x40, 0x40000, 0x40002, 0x8, 0x8, 0x28),
    heading: heading.map((value) => Math.fround(value / length)),
    speedFactor: Math.abs(sampler.sampleUniform(2)),
    defaultTarget: sampleChoice(sampler, -1, 0.5, 1),
    target: sampler.sampleUniform(2),
    velocity: sampleVector(sampler, 1),
    momentum: sampleVector(sampler, 1),
    grounded: sampleChoice(sampler, 0, 4),
    vector: sampleVector(sampler, 300),
    amount: sampler.getIsChance(50) ? sampler.sampleUniform(400) : sampler.sampleUniform(5),
    arguments: [
      sampleChoice(sampler, 1, 2),
      Math.fround(0.0089 + Math.abs(sampler.sampleUniform(0.01))),
      sampleChoice(sampler, 0, 0, 0.5, 3),
    ],
    twoPoint: Array.from({ length: 5 }, () => Math.fround(sampler.sampleUniform(8))),
    timers: [sampleChoice(sampler, 0, 0, 50), sampleChoice(sampler, 0, 0, 100)],
    wheelGeometry: [
      ...sampleVector(sampler, 3),
      sampler.sampleUniform(3),
      sampler.sampleUniform(5),
    ],
    flip: [Math.fround(sampler.sampleUniform(0.01)), sampleChoice(sampler, 125, 150, 250)],
  }
}

const getBodyWords = (item: CommandCase): readonly EmulatorArgument[] => {
  const at = (offset: number): number => offset / 4
  return buildWords(BODY_WORDS, [
    [0, CAR_BODY_VTABLE],
    [1, { buffer: 'body', offset: 0xe4 }],
    ...getFloatEntries(2, item.velocity),
    ...getFloatEntries(at(0x2c), createTestCarBody().rigidBody.localInertia),
    ...getFloatEntries(at(0xa4), item.momentum),
    ...getFloatEntries(at(0xcc), [Math.fround(0.5)]),
    [at(0xe4), FRAME_VTABLE],
    ...getFloatEntries(at(0x10c), [1, 0, 0, 0, 1, 0, 0, 0, 1]),
    ...getFloatEntries(at(0x15c), [Math.fround(0.003)]),
    ...getFloatEntries(at(0x168), item.heading),
    [at(0x36c), item.grounded],
    [at(0x6c0), item.flags],
    [at(0x744), item.isScripted ? 1 : 0],
    ...getFloatEntries(at(0x658), [
      item.twoPoint[0] ?? 0,
      item.twoPoint[1] ?? 0,
      item.twoPoint[2] ?? 0,
    ]),
    ...getFloatEntries(at(0x67c), [item.twoPoint[3] ?? 0, item.twoPoint[4] ?? 0]),
    [at(0x5d8), item.timers[0] ?? 0],
    [at(0x5dc), item.timers[1] ?? 0],
    ...getFloatEntries(at(0x358), item.wheelGeometry.slice(0, 3)),
    ...getFloatEntries(at(0x364), item.wheelGeometry.slice(3)),
    ...getFloatEntries(at(0x778), [item.speedFactor]),
    ...getFloatEntries(at(0x7e8), [item.defaultTarget, item.target]),
  ])
}

const getEmulatorCall = (precision: EmulatorPrecision, item: CommandCase): EmulatorCall => {
  const stackArguments: readonly EmulatorArgument[] =
    item.command === 'IMPULSE'
      ? [{ buffer: 'vector' }, getBitsFromFloat(item.amount)]
      : item.command === 'SPIN'
        ? item.arguments.map(getBitsFromFloat)
        : item.command === 'PUSH_FIRST' || item.command === 'PUSH_SECOND'
          ? [{ buffer: 'vector' }]
          : item.command === 'FLIP'
            ? [getBitsFromFloat(item.flip[0] ?? 0), item.flip[1] ?? 0]
            : []
  return {
    address: Command[item.command].address,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'body' }, ...stackArguments],
    buffers: [
      { name: 'body', words: getBodyWords(item), isRead: true },
      {
        name: 'vector',
        words: getFloatEntries(0, item.vector).map(([, bits]) => bits),
        isRead: false,
      },
    ],
  }
}

const getOriginalWords = (words: readonly number[]): readonly number[] => [
  ...FLOAT_OFFSETS.map((offset) => {
    const bits = words[offset / 4] ?? 0
    return Number.isNaN(getFloatFromBits(bits)) ? getBitsFromFloat(Number.NaN) : bits
  }),
  ...INTEGER_OFFSETS.map((offset) => words[offset / 4] ?? 0),
]

const getPortWords = (body: CarBody): readonly number[] => {
  const { rigidBody } = body
  return [
    ...[
      ...Object.values(rigidBody.linearVelocity),
      ...Object.values(rigidBody.angularMomentum),
      ...Object.values(rigidBody.extraForceA),
      ...Object.values(rigidBody.extraForceB),
      body.speedFactor,
      body.targetSpeedFactor,
      body.defaultTargetSpeedFactor,
      body.scriptedSpinPeriod,
      body.scriptedSpinTime,
      rigidBody.twoPointHeight,
      rigidBody.twoPointTargetHeight,
      rigidBody.twoPointHeightRate,
      ...rigidBody.twoPointPositions.flatMap((point) => [point.x, point.y, point.z]),
      rigidBody.twoPointTargetTilt,
      rigidBody.twoPointTilt,
      body.flipRate,
      body.flipAngle,
    ].map(getBitsFromFloat),
    rigidBody.flags,
    rigidBody.yawTimer,
    rigidBody.spinPeriod,
    rigidBody.spinTimer,
    rigidBody.rollTimer,
    rigidBody.pitchTimer,
  ].map((bits) => bits >>> 0)
}

const getPortBody = (item: CommandCase): CarBody => {
  const body = createTestCarBody()
  const [x, y, z] = item.heading as [number, number, number]
  const [vx, vy, vz] = item.velocity as [number, number, number]
  const [mx, my, mz] = item.momentum as [number, number, number]
  return Object.freeze({
    ...body,
    isScripted: item.isScripted,
    speedFactor: item.speedFactor,
    defaultTargetSpeedFactor: item.defaultTarget,
    targetSpeedFactor: item.target,
    rigidBody: Object.freeze({
      ...body.rigidBody,
      heading: { x, y, z },
      flags: item.flags,
      groundedWheelCount: item.grounded,
      inverseMass: Math.fround(0.5),
      scaledMass: Math.fround(0.003),
      linearVelocity: { x: vx, y: vy, z: vz },
      angularMomentum: { x: mx, y: my, z: mz },
      twoPointHeight: item.twoPoint[0] ?? 0,
      twoPointTargetHeight: item.twoPoint[1] ?? 0,
      twoPointHeightRate: item.twoPoint[2] ?? 0,
      twoPointTargetTilt: item.twoPoint[3] ?? 0,
      twoPointTilt: item.twoPoint[4] ?? 0,
      rollTimer: item.timers[0] ?? 0,
      pitchTimer: item.timers[1] ?? 0,
      localWheelAnchor: {
        x: item.wheelGeometry[0] ?? 0,
        y: item.wheelGeometry[1] ?? 0,
        z: item.wheelGeometry[2] ?? 0,
      },
      trackWidth: item.wheelGeometry[3] ?? 0,
      wheelbase: item.wheelGeometry[4] ?? 0,
    }),
  })
}

const getPortResult = (precision: EmulatorPrecision, item: CommandCase): CarBody => {
  const arithmetic = createFloatArithmetic(precision)
  const body = getPortBody(item)
  const [x, y, z] = item.vector as [number, number, number]
  const vector: Vector3 = { x, y, z }
  const [factor, rate, spinTime] = item.arguments as [number, number, number]
  switch (item.command) {
    case 'IMPULSE':
      return addCarBodyImpulse(arithmetic, body, vector, item.amount)
    case 'SPIN':
      return startCarBodySpin(arithmetic, body, factor, rate, spinTime)
    case 'PUSH_FIRST':
      return setCarBodyPush(arithmetic, body, 'extraForceA', vector)
    case 'RELEASE_FIRST':
      return setCarBodyPush(arithmetic, body, 'extraForceA', undefined)
    case 'PUSH_SECOND':
      return setCarBodyPush(arithmetic, body, 'extraForceB', vector)
    case 'RELEASE_SECOND':
      return setCarBodyPush(arithmetic, body, 'extraForceB', undefined)
    case 'FLIP':
      return startCarBodyFlip(arithmetic, body, item.flip[0] ?? 0, item.flip[1] ?? 0)
    case 'TWO_POINT_ON':
      return setCarBodyTwoPointMode(arithmetic, body)
    case 'TWO_POINT_OFF':
      return clearCarBodyTwoPointMode(body)
  }
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x0429 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getEmulatorCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const original = getOriginalWords(results[index]?.buffers['body'] ?? [])
    const ported = getPortWords(getPortResult(precision, item))
    return original.join() === ported.join() ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('car body commands against the original', () =>
  it.each(PRECISIONS)(
    'slots 8, 9, 12, 13 and 16 to 19 and the flip match the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

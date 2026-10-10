import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
  EmulatorCallResult,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat, getFloatFromBits } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { readOriginalExecutable } from '../../../../shared/testing/original-files.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import { readRacerTables } from '../../services/read-racer-tables/read-racer-tables.ts'
import { createTestCarBody } from '../../types/racer-fixtures/racer-fixtures.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import type { Racer, RacerSet } from '../../types/racer.types.ts'
import { respondToRacerContact } from './racer-contact.ts'

const HANDLER_ADDRESS = 0x00438560
const RANDOM_CURSOR_ADDRESS = 0x004c6ee4
const SPARK_EMITTER_ADDRESS = 0x00489d70
const TRANSFER_EFFECT_ADDRESS = 0x00439900
const END_EFFECT_ADDRESS = 0x00439b00
const RACER_WORDS = 0xe34 / 4
const BODY_WORD = 0x3e8 / 4
const TRANSFER_MARKER_WORD = 0xe30 / 4
const END_MARKER_WORD = 0xe2c / 4
const CASE_COUNT = 400
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const RIGID_FLAG_WITHOUT_TRACK = 0x1000
// The vtables of the racer (0x004b09b0), car body (0x004b04e4), frame (0x004af700), display frame (0x004af754) and collision manager (0x004b0aa8).
const VTABLES = Object.freeze({
  racer: 0x004b09b0,
  carBody: 0x004b04e4,
  frame: 0x004af700,
  displayFrame: 0x004af754,
  manager: 0x004b0aa8,
})
const FLOAT_OFFSETS: readonly number[] = [
  0x08, 0x0c, 0x10, 0xa4, 0xa8, 0xac, 0x630, 0x634, 0x638, 0x63c, 0x640, 0x644, 0x6c4, 0x6c8, 0x6cc,
  0x6d0,
]

type Entry = readonly [number, EmulatorArgument]

type RacerCase = {
  readonly velocity: readonly number[]
  readonly centre: readonly number[]
  readonly inertia: readonly number[]
  readonly inverseMass: number
  readonly flags: number
  readonly controller: number
  readonly rigidFlags: number
  readonly speed: number
  readonly displayRotation: readonly number[]
  readonly sound: number
  readonly attackKind: number
  readonly effectCharge: number
  readonly voiceMilliseconds: number
  readonly fade: number
  readonly isFeedbackPresent: boolean
}

type ContactCase = {
  readonly first: RacerCase
  readonly second: RacerCase
  readonly normal: readonly number[]
  readonly point: readonly number[]
  readonly depth: number
  readonly cursor: number
}

const buildWords = (length: number, entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getFloatEntries = (word: number, values: readonly number[]): readonly Entry[] =>
  values.map((value, index): Entry => [word + index, getBitsFromFloat(value)])

const sampleVector = (sampler: FloatSampler, limit: number): readonly number[] =>
  Array.from({ length: 3 }, () => sampler.sampleUniform(limit))

const sampleUnit = (sampler: FloatSampler): readonly number[] => {
  const vector = sampleVector(sampler, 1)
  const length = Math.hypot(...vector) || 1
  return vector.map((value) => Math.fround(value / length))
}

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleRacer = (sampler: FloatSampler): RacerCase => ({
  velocity: sampleVector(sampler, 0.6),
  centre: sampleVector(sampler, 3),
  inertia: Array.from({ length: 9 }, () =>
    Math.fround(Math.abs(sampler.sampleUniform(0.01)) + 0.002)
  ),
  inverseMass: Math.fround(0.2 + Math.abs(sampler.sampleUniform(1))),
  flags: sampleChoice(sampler, 0, 0, 1, 0x800, 0x10000000),
  controller: sampleChoice(sampler, 0, 2),
  rigidFlags: sampleChoice(sampler, 0, 0x20, 0x40, 0x2) | RIGID_FLAG_WITHOUT_TRACK,
  speed: Math.abs(sampler.sampleUniform(1)),
  displayRotation: sampleUnit(sampler),
  sound: sampleChoice(sampler, 0, 0, 250),
  attackKind: sampleChoice(sampler, 1, 2, 3),
  effectCharge: sampleChoice(sampler, 0, 1000),
  voiceMilliseconds: sampleChoice(sampler, 0, 0, 4000),
  fade: sampleChoice(sampler, 1, 0.5),
  isFeedbackPresent: sampler.getIsChance(50),
})

const sampleContact = (sampler: FloatSampler): ContactCase => ({
  first: sampleRacer(sampler),
  second: sampleRacer(sampler),
  normal: sampleUnit(sampler),
  point: sampleVector(sampler, 3),
  depth: Math.fround(0.01 + Math.abs(sampler.sampleUniform(0.3))),
  cursor: sampler.sampleIntegerBelow(1024),
})

const getRacerWords = (spec: RacerCase, name: string): readonly EmulatorArgument[] => {
  const own = (offset: number): EmulatorArgument => ({ buffer: name, offset })
  const display: EmulatorArgument = { buffer: `${name}Display` }
  const at = (offset: number): number => offset / 4
  return buildWords(RACER_WORDS, [
    [0, VTABLES.racer],
    [1, { buffer: 'sound' }],
    [3, { buffer: 'race' }],
    [at(0x14), spec.isFeedbackPresent ? { buffer: `${name}Feedback` } : 0],
    [at(0x5c), display],
    [at(0xd04), spec.flags],
    [at(0xd08), spec.controller],
    [at(0xd4c), spec.sound],
    [at(0xd6c), spec.attackKind],
    [at(0xd7c), 3000],
    [at(0xd80), spec.effectCharge],
    [at(0xd44), spec.voiceMilliseconds],
    [at(0xd40), 1000],
    [BODY_WORD, VTABLES.carBody],
    [BODY_WORD + 1, own(0x3e8 + 0xe4)],
    ...getFloatEntries(BODY_WORD + 2, spec.velocity),
    ...getFloatEntries(BODY_WORD + 8, spec.centre),
    ...getFloatEntries(BODY_WORD + at(0x2c), createTestCarBody().rigidBody.localInertia),
    ...getFloatEntries(BODY_WORD + at(0x74), spec.inertia),
    ...getFloatEntries(BODY_WORD + at(0xcc), [spec.inverseMass]),
    ...getFloatEntries(BODY_WORD + at(0xdc), [spec.fade]),
    [BODY_WORD + at(0xe0), own(0)],
    [BODY_WORD + at(0xe4), VTABLES.frame],
    ...getFloatEntries(BODY_WORD + at(0x10c), [1, 0, 0, 0, 1, 0, 0, 0, 1]),
    [BODY_WORD + at(0x13c), display],
    ...getFloatEntries(BODY_WORD + at(0x15c), [Math.fround(0.003)]),
    [BODY_WORD + at(0x36c), 4],
    ...getFloatEntries(BODY_WORD + at(0x604), [spec.speed]),
    [BODY_WORD + at(0x6c0), spec.rigidFlags],
    ...getFloatEntries(BODY_WORD + at(0x6c4), [1, -1, Math.fround(Math.PI), 0]),
    ...getFloatEntries(BODY_WORD + at(0x7e8), [1, 1]),
  ])
}

const getDisplayWords = (spec: RacerCase): readonly EmulatorArgument[] =>
  buildWords(32, [
    [0, VTABLES.displayFrame],
    ...getFloatEntries(10, [...spec.displayRotation, 0, 0, 1]),
  ])

const getReturnPatch = (address: number, argumentBytes: number) => ({
  address,
  bytes: [0xc2, argumentBytes, 0],
})

const getEmulatorCall = (precision: EmulatorPrecision, item: ContactCase): EmulatorCall => ({
  address: HANDLER_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'first' }, { buffer: 'event' }],
  buffers: [
    { name: 'first', words: getRacerWords(item.first, 'first'), isRead: true },
    { name: 'second', words: getRacerWords(item.second, 'second'), isRead: true },
    { name: 'firstDisplay', words: getDisplayWords(item.first), isRead: false },
    { name: 'secondDisplay', words: getDisplayWords(item.second), isRead: false },
    { name: 'firstFeedback', words: [1, 0, 0, 0, 0, 0, 0, 0], isRead: true },
    { name: 'secondFeedback', words: [1, 0, 0, 0, 0, 0, 0, 0], isRead: true },
    { name: 'sound', words: [0, 0, 0, 0], isRead: false },
    {
      name: 'race',
      words: buildWords(0x100, [
        [0xf0 / 4, VTABLES.manager],
        [0xf8 / 4, { buffer: 'timerNodes' }],
      ]),
      isRead: false,
    },
    {
      name: 'timerNodes',
      words: buildWords(24, [[10, { buffer: 'timerNodes', offset: 0x2c }]]),
      isRead: true,
    },
    {
      name: 'info',
      words: buildWords(16, [
        ...getFloatEntries(1, item.point),
        ...getFloatEntries(4, item.normal),
        ...getFloatEntries(7, [item.depth]),
        [8, { buffer: 'second', offset: 0x3e8 }],
      ]),
      isRead: false,
    },
    {
      name: 'event',
      words: buildWords(8, [
        [0, 3],
        [4, { buffer: 'first', offset: 0x3e8 }],
        [5, { buffer: 'info' }],
      ]),
      isRead: false,
    },
  ],
  patches: [
    { address: RANDOM_CURSOR_ADDRESS, bytes: [item.cursor & 255, item.cursor >> 8, 0, 0] },
    getReturnPatch(SPARK_EMITTER_ADDRESS, 0x10),
    // mov eax,[esp+4]; mov [ecx+0xe30],eax; ret 8: remembers that the effect was handed over.
    {
      address: TRANSFER_EFFECT_ADDRESS,
      bytes: [0x8b, 0x44, 0x24, 0x04, 0x89, 0x81, 0x30, 0x0e, 0, 0, 0xc2, 8, 0],
    },
    // mov dword [ecx+0xe2c],1; ret: remembers that the effect ended.
    { address: END_EFFECT_ADDRESS, bytes: [0xc7, 0x81, 0x2c, 0x0e, 0, 0, 1, 0, 0, 0, 0xc3] },
  ],
  reads: [{ name: 'cursor', address: RANDOM_CURSOR_ADDRESS, count: 1 }],
})

const getRacerFromCase = (spec: RacerCase): Racer => {
  const body = createTestCarBody()
  const rigidBody = Object.freeze({
    ...body.rigidBody,
    linearVelocity: {
      x: spec.velocity[0] ?? 0,
      y: spec.velocity[1] ?? 0,
      z: spec.velocity[2] ?? 0,
    },
    worldCentreOfMass: { x: spec.centre[0] ?? 0, y: spec.centre[1] ?? 0, z: spec.centre[2] ?? 0 },
    worldInverseInertia: spec.inertia as unknown as Matrix3,
    inverseMass: spec.inverseMass,
    flags: spec.rigidFlags,
    speed: spec.speed,
    scaledMass: Math.fround(0.003),
    groundedWheelCount: 4,
    angularMomentum: { x: 0, y: 0, z: 0 },
    displayFrame: {
      rotation: [...spec.displayRotation, 0, 0, 1] as unknown as Matrix3,
      position: { x: 0, y: 0, z: 0 },
    },
  })
  return Object.freeze({
    ...createRacer(Object.freeze({ ...body, rigidBody, fadeFactor: spec.fade })),
    flags: spec.flags,
    controllerKind: spec.controller,
    collisionSoundMilliseconds: spec.sound,
    attackKind: spec.attackKind,
    timedEffectCharge: spec.effectCharge,
    timedEffectMilliseconds: 3000,
    voiceMilliseconds: spec.voiceMilliseconds,
    forceFeedback: {
      isPresent: spec.isFeedbackPresent,
      strength: 0,
      duration: 0,
      phase: 0,
      state: 0,
      elapsed: 0,
    },
  })
}

type Markers = {
  readonly transferredTo: readonly number[]
  readonly endedOn: readonly number[]
}

const getPortWords = (racerSet: RacerSet, index: number, markers: Markers): readonly number[] => {
  const racer = getRacer(racerSet, index)
  const { rigidBody } = racer.carBody
  const feedback = racer.forceFeedback
  const floats = [
    ...Object.values(rigidBody.linearVelocity),
    ...Object.values(rigidBody.angularMomentum),
    ...Object.values(rigidBody.extraForceA),
    ...Object.values(rigidBody.extraForceB),
    rigidBody.driftYawFactor,
    rigidBody.driftThreshold,
    rigidBody.driftMaximumAngle,
    rigidBody.driftBrake,
  ].map(getBitsFromFloat)
  const integers = [
    rigidBody.flags,
    rigidBody.yawTimer,
    rigidBody.spinPeriod,
    rigidBody.spinTimer,
    racer.flags,
    racer.collisionSoundMilliseconds,
    racer.fadeMilliseconds,
    racer.voiceMilliseconds,
    racer.reactionKind,
    feedback.isPresent ? feedback.strength : 0,
    feedback.isPresent ? feedback.state : 0,
    feedback.isPresent ? feedback.duration : 0,
    markers.transferredTo.includes(index) ? 1 : 0,
    markers.endedOn.includes(index) ? 1 : 0,
  ]
  return [...floats, ...integers.map((value) => value >>> 0)]
}

// The x87's default NaN is 0xffc00000 and JavaScript's 0x7fc00000; any NaN counts as the same.
const getCanonicalBits = (bits: number): number =>
  Number.isNaN(getFloatFromBits(bits)) ? getBitsFromFloat(Number.NaN) : bits

const getOriginalWords = (
  result: EmulatorCallResult | undefined,
  name: 'first' | 'second'
): readonly number[] => {
  const words = result?.buffers[name] ?? []
  const feedback = result?.buffers[`${name}Feedback`] ?? []
  const isFeedbackPresent = (words[0x14 / 4] ?? 0) !== 0
  const body = (offset: number): number => words[BODY_WORD + offset / 4] ?? 0
  const racer = (offset: number): number => words[offset / 4] ?? 0
  return [
    ...FLOAT_OFFSETS.map(body).map(getCanonicalBits),
    body(0x6c0),
    body(0x5e0),
    body(0x5e8),
    body(0x5e4),
    racer(0xd04),
    racer(0xd4c),
    racer(0xd48),
    racer(0xd44),
    racer(0xd70),
    isFeedbackPresent ? (feedback[1] ?? 0) : 0,
    isFeedbackPresent ? (feedback[6] ?? 0) : 0,
    isFeedbackPresent ? (feedback[3] ?? 0) : 0,
    racer(TRANSFER_MARKER_WORD * 4) === 0 ? 0 : 1,
    racer(END_MARKER_WORD * 4),
  ]
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x4385 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleContact(sampler))
  const tables = readRacerTables(readOriginalExecutable())
  const context = {
    arithmetic: createFloatArithmetic(precision),
    tables,
    checkpoints: [],
    collisionObjects: [],
  }
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getEmulatorCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const transferredTo: number[] = []
    const endedOn: number[] = []
    const ported = respondToRacerContact(
      context,
      createRacerSet([getRacerFromCase(item.first), getRacerFromCase(item.second)], item.cursor, 0),
      0,
      1,
      {
        depth: item.depth,
        normal: { x: item.normal[0] ?? 0, y: item.normal[1] ?? 0, z: item.normal[2] ?? 0 },
        point: { x: item.point[0] ?? 0, y: item.point[1] ?? 0, z: item.point[2] ?? 0 },
      },
      {
        separateScriptedCarBody: (_context, racerSet) => racerSet,
        transferTimedEffect: (_context, racerSet, receiver) => {
          transferredTo.push(receiver)
          return racerSet
        },
        endTimedEffect: (_context, racerSet, racerIndex) => {
          endedOn.push(racerIndex)
          return racerSet
        },
      }
    )
    const markers = { transferredTo, endedOn }
    const original = results[index]
    const isSame =
      getOriginalWords(original, 'first').join() === getPortWords(ported, 0, markers).join() &&
      getOriginalWords(original, 'second').join() === getPortWords(ported, 1, markers).join() &&
      original?.buffers['cursor']?.[0] === ported.randomPosition
    return isSame ? [] : [index]
  })

  const getCount = (isMatch: (words: readonly number[]) => boolean): number =>
    results.filter(
      (result) => isMatch(result.buffers['first'] ?? []) || isMatch(result.buffers['second'] ?? [])
    ).length

  // Assert
  expect(mismatches).toEqual([])
  expect(getCount((words) => (words[TRANSFER_MARKER_WORD] ?? 0) !== 0)).toBeGreaterThan(0)
  expect(getCount((words) => (words[0xd70 / 4] ?? 0) !== 0)).toBeGreaterThan(0)
  expect(getCount((words) => (words[BODY_WORD + 0x5e0 / 4] ?? 0) !== 0)).toBeGreaterThan(0)
  expect(getCount((words) => (words[0xd48 / 4] ?? 0) !== 0)).toBeGreaterThan(0)
}

describe.skipIf(!getIsEmulatorAvailable())('racer contact response against the original', () =>
  it.each(PRECISIONS)(
    '0x00438560 (type 3 events) matches the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

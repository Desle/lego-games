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
import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { readOriginalExecutable } from '../../../../shared/testing/original-files.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import { readRacerTables } from '../../services/read-racer-tables/read-racer-tables.ts'
import { createFigure } from '../../types/figure/figure.ts'
import { createTestCarBody } from '../../types/racer-fixtures/racer-fixtures.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import type { Racer, RacerSet } from '../../types/racer.types.ts'
import { collideRacers } from './collide-racers.ts'

const MANAGER_UPDATE_ADDRESS = 0x0043d180
const RANDOM_CURSOR_ADDRESS = 0x004c6ee4
const SPARK_EMITTER_ADDRESS = 0x00489d70
const TRANSFER_EFFECT_ADDRESS = 0x00439900
const END_EFFECT_ADDRESS = 0x00439b00
const RACER_WORDS = 0xe34 / 4
const BODY_WORD = 0x3e8 / 4
const NODE_WORDS = 0x2c / 4
const MANAGER_WORD = 0xf0 / 4
const CASE_COUNT = 300
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const RIGID_FLAG_WITHOUT_TRACK = 0x1000
const VTABLES = Object.freeze({
  racer: 0x004b09b0,
  carBody: 0x004b04e4,
  frame: 0x004af700,
  displayFrame: 0x004af5ec,
  manager: 0x004b0aa8,
})
const FLOAT_OFFSETS: readonly number[] = [0x08, 0x0c, 0x10, 0x130, 0x134, 0x138]
const RACER_COUNT_CHOICES: readonly number[] = [2, 3, 4]

type Entry = readonly [number, EmulatorArgument]

type RacerCase = {
  readonly position: readonly number[]
  readonly rotation: readonly number[]
  readonly dimensions: readonly number[]
  readonly velocity: readonly number[]
  readonly sphereCentre: readonly number[]
  readonly radius: number
  readonly figureFlags: number
  readonly animationBounds: readonly (readonly number[])[]
  readonly scale: number
  readonly inertia: readonly number[]
  readonly inverseMass: number
  readonly speed: number
  readonly fade: number
  readonly flags: number
  readonly controller: number
  readonly voiceMilliseconds: number
  readonly timer: number | null
}

type ManagerCase = {
  readonly racers: readonly RacerCase[]
  readonly order: readonly number[]
  readonly step: number
  readonly cursor: number
}

const buildWords = (length: number, entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getFloatEntries = (word: number, values: readonly number[]): readonly Entry[] =>
  values.map((value, index): Entry => [word + index, getBitsFromFloat(value)])

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleVector = (sampler: FloatSampler, limit: number): readonly number[] =>
  Array.from({ length: 3 }, () => sampler.sampleUniform(limit))

const sampleRotation = (sampler: FloatSampler): readonly number[] => {
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
  ].map(Math.fround)
}

const sampleRacer = (sampler: FloatSampler): RacerCase => ({
  position: [...sampleVector(sampler, 4).slice(0, 2), Math.abs(sampler.sampleUniform(0.5))],
  rotation: sampleRotation(sampler),
  dimensions: [1, 2, 0.8].map((base) => Math.fround(base + Math.abs(sampler.sampleUniform(1)))),
  velocity: sampleVector(sampler, 0.5),
  sphereCentre: sampleVector(sampler, 0.2),
  radius: Math.fround(1.5 + Math.abs(sampler.sampleUniform(1))),
  figureFlags: sampleChoice(sampler, 0, 0x10000, 0x10000 | 0x20000),
  animationBounds: Array.from({ length: 2 }, () => [
    ...sampleVector(sampler, 0.3),
    Math.fround(1.5 + Math.abs(sampler.sampleUniform(1))),
  ]),
  scale: sampleChoice(sampler, 1, 1, Math.fround(0.9)),
  inertia: Array.from({ length: 9 }, () =>
    Math.fround(Math.abs(sampler.sampleUniform(0.01)) + 0.002)
  ),
  inverseMass: Math.fround(0.3 + Math.abs(sampler.sampleUniform(0.5))),
  speed: Math.abs(sampler.sampleUniform(1)),
  fade: sampleChoice(sampler, 1, 1, Math.fround(0.7)),
  flags: sampleChoice(sampler, 0, 0, 0, 1),
  controller: sampleChoice(sampler, 0, 2),
  voiceMilliseconds: sampleChoice(sampler, 0, 3000),
  timer: sampler.getIsChance(30) ? sampleChoice(sampler, 720, 735) : null,
})

const sampleManagerCase = (sampler: FloatSampler): ManagerCase => {
  const count = sampleChoice(sampler, ...RACER_COUNT_CHOICES)
  const order = Array.from({ length: count }, (_, index) => count - 1 - index)
  return {
    racers: Array.from({ length: count }, () => sampleRacer(sampler)),
    order: sampler.getIsChance(50) ? order.reverse() : order,
    step: sampleChoice(sampler, 1, 16, 40),
    cursor: sampler.sampleIntegerBelow(1024),
  }
}

const getRacerName = (index: number): string => `racer${String(index)}`

const getRacerWords = (spec: RacerCase, index: number): readonly EmulatorArgument[] => {
  const name = getRacerName(index)
  const own = (offset: number): EmulatorArgument => ({ buffer: name, offset })
  const display: EmulatorArgument = { buffer: `${name}Display` }
  const at = (offset: number): number => offset / 4
  return buildWords(RACER_WORDS, [
    [0, VTABLES.racer],
    [1, { buffer: 'sound' }],
    [3, { buffer: 'race' }],
    [at(0x5c), display],
    [at(0xd04), spec.flags | (spec.timer === null ? 0 : 0x100)],
    [at(0xd08), spec.controller],
    [at(0xd6c), 1],
    [at(0xd70), spec.timer === null ? 0 : 1],
    [at(0xd44), spec.voiceMilliseconds],
    [at(0xd40), 1000],
    [BODY_WORD, VTABLES.carBody],
    [BODY_WORD + 1, own(0x3e8 + 0xe4)],
    ...getFloatEntries(BODY_WORD + 2, spec.velocity),
    ...getFloatEntries(BODY_WORD + 8, spec.position),
    ...getFloatEntries(BODY_WORD + at(0x2c), createTestCarBody().rigidBody.localInertia),
    ...getFloatEntries(BODY_WORD + at(0x74), spec.inertia),
    ...getFloatEntries(BODY_WORD + at(0xcc), [spec.inverseMass]),
    ...getFloatEntries(BODY_WORD + at(0xd0), spec.dimensions),
    ...getFloatEntries(BODY_WORD + at(0xdc), [spec.fade]),
    [BODY_WORD + at(0xe0), own(0)],
    [BODY_WORD + at(0xe4), VTABLES.frame],
    ...getFloatEntries(BODY_WORD + at(0x10c), spec.rotation),
    ...getFloatEntries(BODY_WORD + at(0x130), spec.position),
    [BODY_WORD + at(0x13c), display],
    ...getFloatEntries(BODY_WORD + at(0x15c), [Math.fround(0.003)]),
    [BODY_WORD + at(0x36c), 4],
    ...getFloatEntries(BODY_WORD + at(0x604), [spec.speed]),
    [BODY_WORD + at(0x6c0), RIGID_FLAG_WITHOUT_TRACK],
    ...getFloatEntries(BODY_WORD + at(0x6c4), [1, -1, Math.fround(Math.PI), 0]),
    ...getFloatEntries(BODY_WORD + at(0x7e8), [1, 1]),
  ])
}

const getDisplayWords = (spec: RacerCase, index: number): readonly EmulatorArgument[] =>
  buildWords(64, [
    [0, VTABLES.displayFrame],
    ...getFloatEntries(0x10 / 4, [-1]),
    ...getFloatEntries(10, spec.rotation),
    ...getFloatEntries(0x4c / 4, spec.position),
    ...getFloatEntries(0x58 / 4, [spec.scale]),
    [0x5c / 4, spec.figureFlags],
    [0x78 / 4, { buffer: `${getRacerName(index)}Child` }],
    [0xa8 / 4, { buffer: `${getRacerName(index)}Set` }],
    [0xbc / 4, 0],
    [0xd8 / 4, 1],
  ])

const getChildWords = (spec: RacerCase): readonly EmulatorArgument[] =>
  buildWords(16, [
    ...getFloatEntries(0x28 / 4, spec.sphereCentre),
    ...getFloatEntries(0x34 / 4, [spec.radius, Math.fround(0.75)]),
  ])

const getRecordWords = (spec: RacerCase): readonly EmulatorArgument[] =>
  spec.animationBounds.flatMap((bounds) => buildWords(10, getFloatEntries(4, bounds)))

const getNodeAddress = (index: number): EmulatorArgument => ({
  buffer: 'nodes',
  offset: index * NODE_WORDS * 4,
})

const getNodeWords = (item: ManagerCase): readonly EmulatorArgument[] =>
  item.racers.flatMap((_, racerIndex) => {
    const position = item.order.indexOf(racerIndex)
    const previous = item.order[position - 1]
    const next = item.order[position + 1]
    return buildWords(NODE_WORDS, [
      [0, { buffer: getRacerName(racerIndex) }],
      [1, 3],
      [2, 5],
      [5, { buffer: getRacerName(racerIndex), offset: 0x3e8 }],
      [6, previous === undefined ? 0 : getNodeAddress(previous)],
      [9, 1],
      [10, next === undefined ? 0 : getNodeAddress(next)],
    ])
  })

const getTimerWords = (item: ManagerCase): readonly EmulatorArgument[] =>
  item.racers.flatMap((spec, racerIndex) =>
    buildWords(NODE_WORDS, [
      [0, { buffer: getRacerName(racerIndex) }],
      [1, 1],
      [3, 1],
      [5, 750],
      [6, spec.timer ?? 0],
      [9, spec.timer === null ? 0 : 1],
      [
        10,
        racerIndex + 1 < item.racers.length
          ? { buffer: 'timers', offset: (racerIndex + 1) * NODE_WORDS * 4 }
          : 0,
      ],
    ])
  )

const getReturnPatch = (address: number, argumentBytes: number) => ({
  address,
  bytes: [0xc2, argumentBytes, 0],
})

const getEmulatorCall = (precision: EmulatorPrecision, item: ManagerCase): EmulatorCall => ({
  address: MANAGER_UPDATE_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'race', offset: MANAGER_WORD * 4 }, item.step],
  buffers: [
    ...item.racers.flatMap((spec, index) => [
      { name: getRacerName(index), words: getRacerWords(spec, index), isRead: true },
      { name: `${getRacerName(index)}Display`, words: getDisplayWords(spec, index), isRead: true },
      { name: `${getRacerName(index)}Child`, words: getChildWords(spec), isRead: false },
      {
        name: `${getRacerName(index)}Set`,
        words: buildWords(16, [[0x2c / 4, { buffer: `${getRacerName(index)}Records` }]]),
        isRead: false,
      },
      { name: `${getRacerName(index)}Records`, words: getRecordWords(spec), isRead: false },
    ]),
    { name: 'sound', words: [0, 0, 0, 0], isRead: false },
    { name: 'nodes', words: getNodeWords(item), isRead: true },
    { name: 'timers', words: getTimerWords(item), isRead: false },
    {
      name: 'race',
      words: buildWords(0x100, [
        [MANAGER_WORD, VTABLES.manager],
        // The free list: two spare nodes for the timers the response adds.
        [MANAGER_WORD + 2, { buffer: 'spare' }],
        [MANAGER_WORD + 3, { buffer: 'timers' }],
        [MANAGER_WORD + 11, getNodeAddress(item.order[0] ?? 0)],
      ]),
      isRead: true,
    },
    {
      name: 'spare',
      words: buildWords(NODE_WORDS * 8, [
        [10, { buffer: 'spare', offset: NODE_WORDS * 4 }],
        [NODE_WORDS + 10, { buffer: 'spare', offset: 2 * NODE_WORDS * 4 }],
        [2 * NODE_WORDS + 10, { buffer: 'spare', offset: 3 * NODE_WORDS * 4 }],
      ]),
      isRead: false,
    },
  ],
  patches: [
    { address: RANDOM_CURSOR_ADDRESS, bytes: [item.cursor & 255, item.cursor >> 8, 0, 0] },
    getReturnPatch(SPARK_EMITTER_ADDRESS, 0x10),
    getReturnPatch(TRANSFER_EFFECT_ADDRESS, 8),
    { address: END_EFFECT_ADDRESS, bytes: [0xc3] },
  ],
  reads: [{ name: 'cursor', address: RANDOM_CURSOR_ADDRESS, count: 1 }],
})

const getRacerFromCase = (spec: RacerCase): Racer => {
  const body = createTestCarBody()
  const [x, y, z] = spec.position as [number, number, number]
  const frame = {
    rotation: spec.rotation as unknown as Matrix3,
    position: { x, y, z },
  }
  const [width, length, height] = spec.dimensions as [number, number, number]
  const [vx, vy, vz] = spec.velocity as [number, number, number]
  const [cx, cy, cz] = spec.sphereCentre as [number, number, number]
  const figure = {
    ...createFigure(
      spec.animationBounds.map(([ax, ay, az, radius]) => ({
        rate: 0,
        vector: { x: 0, y: 0, z: 0 },
        boundsCentre: { x: ax ?? 0, y: ay ?? 0, z: az ?? 0 },
        boundsRadius: radius ?? 0,
        frameCount: 10,
        period: 10,
      })),
      { centre: { x: cx, y: cy, z: cz }, radius: spec.radius, radiusScale: Math.fround(0.75) }
    ),
    flags: spec.figureFlags,
    currentId: 0,
    targetId: 1,
    scale: spec.scale,
  }
  const rigidBody = Object.freeze({
    ...body.rigidBody,
    frame,
    displayFrame: frame,
    dimensions: { x: width, y: length, z: height },
    linearVelocity: { x: vx, y: vy, z: vz },
    worldCentreOfMass: frame.position,
    worldInverseInertia: spec.inertia as unknown as Matrix3,
    inverseMass: spec.inverseMass,
    speed: spec.speed,
    flags: RIGID_FLAG_WITHOUT_TRACK,
    scaledMass: Math.fround(0.003),
    groundedWheelCount: 4,
  })
  return Object.freeze({
    ...createRacer(Object.freeze({ ...body, rigidBody, fadeFactor: spec.fade }), figure),
    flags: spec.flags | (spec.timer === null ? 0 : 0x100),
    controllerKind: spec.controller,
    attackKind: 1,
    voiceMilliseconds: spec.voiceMilliseconds,
    reactionKind: spec.timer === null ? 0 : 1,
    contactTimerMilliseconds: spec.timer,
  })
}

// The list order after the call: the head pointer (race +0xf0 + 0x2c) and every node's next pointer (word 10), as indexes.
const getOriginalOrder = (result: EmulatorCallResult | undefined): readonly number[] => {
  const nodes = result?.buffers['nodes'] ?? []
  const head = result?.buffers['race']?.[MANAGER_WORD + 11] ?? 0
  const nextPointers = Array.from(
    { length: nodes.length / NODE_WORDS },
    (_, index) => nodes[index * NODE_WORDS + 10] ?? 0
  ).filter((pointer) => pointer !== 0)
  const nodeSize = NODE_WORDS * 4
  const base = Math.min(head, ...nextPointers)
  const order: number[] = []
  for (let pointer = head; pointer !== 0 && order.length < 16;) {
    const index = (pointer - base) / nodeSize
    order.push(index)
    pointer = nodes[index * NODE_WORDS + 10] ?? 0
  }
  return order
}

const getPortWords = (racerSet: RacerSet, index: number): readonly number[] => {
  const racer = getRacer(racerSet, index)
  const { rigidBody } = racer.carBody
  return [
    ...[
      ...Object.values(rigidBody.linearVelocity),
      rigidBody.frame.position.x,
      rigidBody.frame.position.y,
      rigidBody.frame.position.z,
    ].map(getBitsFromFloat),
    racer.flags,
    racer.reactionKind,
    racer.collisionSoundMilliseconds,
    racer.voiceMilliseconds,
  ].map((bits) => bits >>> 0)
}

const getOriginalWords = (result: EmulatorCallResult | undefined, index: number) => {
  const words = result?.buffers[getRacerName(index)] ?? []
  const body = (offset: number): number => words[BODY_WORD + offset / 4] ?? 0
  return [
    ...FLOAT_OFFSETS.map(body),
    words[0xd04 / 4] ?? 0,
    words[0xd70 / 4] ?? 0,
    words[0xd4c / 4] ?? 0,
    words[0xd44 / 4] ?? 0,
  ]
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x43d1 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleManagerCase(sampler))
  const context = {
    arithmetic: createFloatArithmetic(precision),
    tables: readRacerTables(readOriginalExecutable()),
    checkpoints: [],
    collisionObjects: [],
    raceLapCount: 3,
  }
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getEmulatorCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, caseIndex) => {
    const ported = collideRacers(
      context,
      {
        ...createRacerSet(item.racers.map(getRacerFromCase), item.cursor, 0),
        collisionOrder: item.order,
      },
      item.step,
      {
        getIsTouchingRegistryEntry: () => false,
        separateScriptedCarBody: (_context, racerSet) => racerSet,
        transferTimedEffect: (_context, racerSet) => racerSet,
        endTimedEffect: (_context, racerSet) => racerSet,
      }
    )
    const original = results[caseIndex]
    const isSame =
      item.racers.every(
        (_, index) =>
          getOriginalWords(original, index).join() === getPortWords(ported, index).join()
      ) &&
      original?.buffers['cursor']?.[0] === ported.randomPosition &&
      getOriginalOrder(original).join() === ported.collisionOrder.join()
    return isSame ? [] : [caseIndex]
  })

  const getChangedCount = (hasChanged: (item: ManagerCase, index: number) => boolean): number =>
    cases.filter((item, index) => hasChanged(item, index)).length

  // Assert
  expect(mismatches).toEqual([])
  expect(
    getChangedCount((item, index) => getOriginalOrder(results[index]).join() !== item.order.join())
  ).toBeGreaterThan(0)
  expect(
    getChangedCount((item, index) =>
      item.racers.some(
        (_, racer) =>
          ((results[index]?.buffers[getRacerName(racer)]?.[0xd04 / 4] ?? 0) & 0x10000000) !== 0
      )
    )
  ).toBeGreaterThan(CASE_COUNT / 10)
}

describe.skipIf(!getIsEmulatorAvailable())('the collision manager against the original', () =>
  it.each(PRECISIONS)(
    '0x0043d180 matches the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

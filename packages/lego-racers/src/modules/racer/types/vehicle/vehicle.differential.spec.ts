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
import { getBitsFromFloat, getIsSameFloatBits } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { readOriginalExecutable } from '../../../../shared/testing/original-files.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import { readRacerTables } from '../../services/read-racer-tables/read-racer-tables.ts'
import { createFigure } from '../figure/figure.ts'
import { createTestCarBodyWith } from '../racer-fixtures/racer-fixtures.ts'
import { createRacer, createRacerSet, getRacer } from '../racer-state/racer-state.ts'
import type { Figure, FigureAnimation, Racer, RacerSet } from '../racer.types.ts'
import { createVehicle, updateVehicleDriver } from './vehicle.ts'

const DRIVER_UPDATE_ADDRESS = 0x0043ec10
const RANDOM_CURSOR_ADDRESS = 0x004c6ee4
const LAP_COUNT_ADDRESS = 0x004bef70
const FIGURE_VTABLE = 0x004af5ec
const RACER_WORDS = 0xe34 / 4
const FIGURE_WORDS = 64
const RECORD_WORDS = 10
const ANIMATION_COUNT = 0x12
const RACERS_BASE = 0x20000000
const VEHICLE_OFFSET = 0x18
const CASE_COUNT = 800
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

type Entry = readonly [number, EmulatorArgument]

type DriverCase = {
  readonly racerCount: number
  readonly positions: readonly (readonly number[])[]
  readonly rotation: readonly number[]
  readonly driverFlags: number
  readonly driverId: number
  readonly targetId: number
  readonly reactionFlags: number
  readonly lookMilliseconds: number
  readonly previousSpeed: number
  readonly forwardSpeed: number
  readonly curvature: number
  readonly throttle: number
  readonly lap: number
  readonly racePosition: number
  readonly voiceMilliseconds: number
  readonly isFeedbackPresent: boolean
  readonly step: number
  readonly cursor: number
  readonly animations: readonly FigureAnimation[]
  readonly lapCount: number
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

const sampleAnimation = (sampler: FloatSampler): FigureAnimation => ({
  rate: Math.abs(sampler.sampleUniform(0.05)),
  vector: { x: 0, y: 0, z: 0 },
  boundsCentre: { x: 0, y: 0, z: 0 },
  boundsRadius: 1,
  frameCount: sampleChoice(sampler, 5, 20),
  period: sampleChoice(sampler, 4, 19),
})

const sampleCase = (sampler: FloatSampler): DriverCase => {
  const racerCount = sampleChoice(sampler, 1, 2, 3)
  const rotationAngle = sampler.sampleAngle(6.3)
  const [cosine, sine] = [Math.cos(rotationAngle), Math.sin(rotationAngle)]
  const lapCount = 3
  return {
    racerCount,
    positions: Array.from({ length: racerCount }, (_, index) =>
      index === 0 ? sampleVector(sampler, 5) : sampleVector(sampler, 100)
    ),
    rotation: [cosine, sine, 0, -sine, cosine, 0, 0, 0, 1].map(Math.fround),
    driverFlags: sampleChoice(sampler, 0x10000, 0x10000, 0x10000 | 0x40000, 0),
    driverId: sampleChoice(
      sampler,
      0,
      1,
      2,
      3,
      5,
      6,
      7,
      8,
      9,
      9,
      9,
      0xa,
      0xb,
      0xc,
      0xd,
      0xe,
      0xf,
      0x10,
      0x11
    ),
    targetId: sampleChoice(sampler, 9, 3),
    reactionFlags: sampleChoice(sampler, 0, 0, 0, 1, 2),
    lookMilliseconds: sampleChoice(sampler, 0, 0, 0, 100),
    previousSpeed: sampleChoice(sampler, 0, 0.5, 1),
    forwardSpeed: sampleChoice(
      sampler,
      0,
      0.005,
      0.5,
      -0.3,
      0.00001,
      Math.abs(sampler.sampleUniform(1)),
      sampler.sampleUniform(1)
    ),
    curvature: sampleChoice(sampler, 0, 0, 40, -40),
    throttle: sampleChoice(sampler, 0, 100, -100),
    lap: sampleChoice(sampler, 0, 1, 2, 3, 4),
    racePosition: sampleChoice(sampler, 1, 2, 3),
    voiceMilliseconds: sampleChoice(sampler, 0, 0, 3000),
    isFeedbackPresent: sampler.getIsChance(50),
    step: sampleChoice(sampler, 1, 16, 40),
    cursor: sampler.sampleIntegerBelow(1024),
    animations: Array.from({ length: ANIMATION_COUNT }, () => sampleAnimation(sampler)),
    lapCount,
  }
}

const getFigureWords = (
  item: DriverCase,
  name: string,
  position: readonly number[],
  isDriver: boolean
): readonly EmulatorArgument[] =>
  buildWords(FIGURE_WORDS, [
    [0, FIGURE_VTABLE],
    ...getFloatEntries(0x28 / 4, item.rotation),
    ...getFloatEntries(0x4c / 4, position),
    ...getFloatEntries(0x58 / 4, [1]),
    [0x5c / 4, isDriver ? item.driverFlags : 0],
    [0xa8 / 4, { buffer: `${name}Set` }],
    [0xbc / 4, isDriver ? item.driverId : 0],
    [0xd8 / 4, isDriver ? item.targetId : 0],
    ...getFloatEntries(0xec / 4, [1, 0.0033333333]),
  ])

const getRecordWords = (animations: readonly FigureAnimation[]): readonly EmulatorArgument[] =>
  animations.flatMap((animation) =>
    buildWords(RECORD_WORDS, [
      ...getFloatEntries(0, [animation.rate]),
      [9, animation.frameCount | (animation.period << 16)],
    ])
  )

const getRacerWords = (item: DriverCase, index: number): readonly EmulatorArgument[] => {
  const base = RACERS_BASE + index * 0xe34
  base
  const at = (offset: number): number => offset / 4
  const own = (offset: number): EmulatorArgument => ({
    buffer: 'racers',
    offset: index * 0xe34 + offset,
  })
  const vehicle = (offset: number): number => at(VEHICLE_OFFSET + offset)
  return buildWords(RACER_WORDS, [
    [at(4), { buffer: 'sound' }],
    [at(0xc), { buffer: 'racerSet' }],
    [at(0x14), index === 0 && item.isFeedbackPresent ? { buffer: 'feedback' } : 0],
    [at(0x5c), { buffer: `figure${String(index)}` }],
    [vehicle(0x44), { buffer: `figure${String(index)}` }],
    [vehicle(0x48), index === 0 ? { buffer: 'driverFigure' } : 0],
    [vehicle(0x1d8), own(0)],
    [vehicle(0x1dc), own(0x3e8)],
    ...(index === 0
      ? [
          [vehicle(0x384), item.reactionFlags] as Entry,
          [vehicle(0x388), item.lookMilliseconds] as Entry,
          ...getFloatEntries(vehicle(0x38c), [item.previousSpeed]),
          ...getFloatEntries(at(0x3e8 + 0x618), [item.forwardSpeed]),
          [at(0xce4), item.lap] as Entry,
          [at(0xd00), item.racePosition] as Entry,
          ...getFloatEntries(at(0xc70 + 0xc), [item.curvature, item.throttle]),
          [at(0xd44), item.voiceMilliseconds] as Entry,
          [at(0xd40), 1000] as Entry,
        ]
      : []),
  ])
}

const getEmulatorCall = (precision: EmulatorPrecision, item: DriverCase): EmulatorCall => ({
  address: DRIVER_UPDATE_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'racers', offset: VEHICLE_OFFSET }, item.step],
  buffers: [
    {
      name: 'racers',
      words: Array.from({ length: item.racerCount }, (_, index) =>
        getRacerWords(item, index)
      ).flat(),
      isRead: true,
    },
    ...item.positions.map((position, index) => ({
      name: `figure${String(index)}`,
      words: getFigureWords(item, `figure${String(index)}`, position, false),
      isRead: false,
    })),
    ...item.positions.map((_, index) => ({
      name: `figure${String(index)}Set`,
      words: buildWords(16, [[0x2c / 4, { buffer: 'records' }]]),
      isRead: false,
    })),
    { name: 'driverFigure', words: getFigureWords(item, 'driver', [0, 0, 0], true), isRead: true },
    {
      name: 'driverSet',
      words: buildWords(16, [[0x2c / 4, { buffer: 'records' }]]),
      isRead: false,
    },
    { name: 'records', words: getRecordWords(item.animations), isRead: false },
    {
      name: 'racerSet',
      words: buildWords(0x200, [
        [0x140 / 4, { buffer: 'racers' }],
        [0x144 / 4, item.racerCount],
      ]),
      isRead: false,
    },
    { name: 'sound', words: [0, 0, 0, 0], isRead: false },
    { name: 'feedback', words: [1, 0, 0, 0, 0, 0, 0, 0], isRead: true },
  ],
  patches: [
    { address: RANDOM_CURSOR_ADDRESS, bytes: [item.cursor & 255, item.cursor >> 8, 0, 0] },
    { address: LAP_COUNT_ADDRESS, bytes: [item.lapCount, 0, 0, 0] },
  ],
  reads: [{ name: 'cursor', address: RANDOM_CURSOR_ADDRESS, count: 1 }],
})

const getPortRacers = (item: DriverCase): readonly Racer[] =>
  item.positions.map((position, index) => {
    const [x, y, z] = position as [number, number, number]
    const figure: Figure = createFigure(item.animations, null)
    const racer = createRacer(
      createTestCarBodyWith({
        displayFrame: {
          rotation: item.rotation as unknown as readonly [
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
          ],
          position: { x, y, z },
        },
        forwardSpeed: index === 0 ? item.forwardSpeed : 0,
      }),
      figure
    )
    if (index !== 0) return racer
    return Object.freeze({
      ...racer,
      currentLap: item.lap,
      racePosition: item.racePosition,
      voiceMilliseconds: item.voiceMilliseconds,
      driver: { ...racer.driver, curvature: item.curvature, throttle: item.throttle },
      forceFeedback: {
        isPresent: item.isFeedbackPresent,
        strength: 0,
        duration: 0,
        phase: 0,
        state: 0,
        elapsed: 0,
      },
      vehicle: {
        ...createVehicle({
          ...createFigure(item.animations, null),
          flags: item.driverFlags,
          currentId: item.driverId,
          targetId: item.targetId,
          blend: 1,
          blendRate: Math.fround(0.0033333333),
        }),
        reactionFlags: item.reactionFlags,
        lookMilliseconds: item.lookMilliseconds,
        previousForwardSpeed: item.previousSpeed,
      },
    })
  })

const getPortWords = (racerSet: RacerSet): readonly number[] => {
  const racer = getRacer(racerSet, 0)
  const { vehicle } = racer
  const figure = vehicle.driverFigure
  return [
    figure.flags >>> 0,
    figure.currentId,
    figure.targetId,
    ...[figure.currentTime, figure.currentRate].map(getBitsFromFloat),
    vehicle.reactionFlags,
    vehicle.lookMilliseconds,
    getBitsFromFloat(vehicle.previousForwardSpeed),
    vehicle.watchedRacerIndex,
    racer.voiceMilliseconds,
    racer.forceFeedback.isPresent ? racer.forceFeedback.state : 0,
    racer.forceFeedback.isPresent ? racer.forceFeedback.strength : 0,
    racerSet.randomPosition,
  ]
}

const getOriginalWords = (result: EmulatorCallResult | undefined): readonly number[] => {
  const racers = result?.buffers['racers'] ?? []
  const figure = result?.buffers['driverFigure'] ?? []
  const feedback = result?.buffers['feedback'] ?? []
  const vehicle = (offset: number): number => racers[(VEHICLE_OFFSET + offset) / 4] ?? 0
  const watched = vehicle(0x380)
  const isFeedbackPresent = (racers[0x14 / 4] ?? 0) !== 0
  return [
    figure[0x5c / 4] ?? 0,
    (figure[0xbc / 4] ?? 0) & 0xffff,
    (figure[0xd8 / 4] ?? 0) & 0xffff,
    figure[0xb4 / 4] ?? 0,
    figure[0xb8 / 4] ?? 0,
    vehicle(0x384),
    vehicle(0x388),
    vehicle(0x38c),
    (watched === 0 ? -1 : (watched - RACERS_BASE) / 0xe34) >>> 0,
    racers[0xd44 / 4] ?? 0,
    isFeedbackPresent ? (feedback[6] ?? 0) : 0,
    isFeedbackPresent ? (feedback[1] ?? 0) : 0,
    result?.buffers['cursor']?.[0] ?? 0,
  ]
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x43ec + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleCase(sampler))
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
  const mismatches = cases.flatMap((item, index) => {
    const ported = updateVehicleDriver(
      context,
      createRacerSet(getPortRacers(item), item.cursor, 0),
      0,
      item.step
    )
    const original = getOriginalWords(results[index])
    const portWords = getPortWords(ported).map((value) => value >>> 0)
    const isSame = original.every(
      (bits, word) =>
        getIsSameFloatBits(bits, (portWords[word] ?? 0) >>> 0) ||
        (word === 8 && bits === (portWords[word] ?? 0))
    )
    return isSame ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('the driver figure choice against the original', () =>
  it.each(PRECISIONS)(
    '0x0043ec10 matches the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

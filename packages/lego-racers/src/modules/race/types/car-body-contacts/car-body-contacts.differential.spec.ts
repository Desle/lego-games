import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorBuffer,
  EmulatorCall,
  EmulatorPatch,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import type { Checkpoint } from '../../../checkpoint/index.ts'
import type { Racer } from '../../../racer/index.ts'
import type { CarWheel } from '../../../racer-physics/index.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { TrackMaterial } from '../../../track-material/index.ts'
import { createFixtureRacer } from '../race-fixtures/race-fixtures.ts'
import { getRacerAfterCheckpointContact } from '../checkpoint-touch/checkpoint-touch.ts'
import type {
  CarBodyContact,
  SurfaceMaterials,
} from '../surface-materials/surface-materials.types.ts'
import { createCarBodyContactHooks } from './car-body-contacts.ts'

const FILTER_ADDRESS = 0x0042a830
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const BODY_WORDS = 0x888 / 4
const RACER_WORDS = 0xe34 / 4
// The checkpoint record and the track-material entry are both read through the material's property pointer (+0x14).
const PROPERTY_WORDS = 0x5c / 4
const MATERIAL_WORDS = 0x20 / 4
const TRIANGLE_WORDS = 0x40 / 4
const CHECKPOINT_INDEX = 3

const At = Object.freeze({
  racerPointer: 0x6f0,
  eventsPointer: 0x6f4,
  checkpointObject: 0x6fc,
  checkpointPointer: 0xcc4,
  checkpointSide: 0xcc8,
  lapCount: 0xce0,
  currentLap: 0xce4,
  flags: 0xd04,
  zoneCurrent: 0xd0c,
  zonePrevious: 0xd10,
  zoneBeforePrevious: 0xd14,
  lap: 0xd18,
})

type FilterCase = {
  // 0: the checkpoint object's digit-named material; 1: a material with a track-material entry; 2: none.
  readonly kind: 0 | 1 | 2
  readonly flags: number
  readonly isCheckpointObject: boolean
  readonly plane: readonly number[]
  readonly progress: number
  readonly normal: readonly number[]
  readonly racerFlags: number
  readonly zones: readonly number[]
  readonly lap: number
  readonly lapCount: number
  readonly currentLap: number
  readonly side: number
  readonly identifier: number
}

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleKind = (sampler: FloatSampler): 0 | 1 | 2 =>
  sampleChoice(sampler, 0, 0, 1, 1, 1, 2) as 0 | 1 | 2

// Digit-named materials only exist in the checkpoint object (0x00435e70).
const sampleFilterCase = (sampler: FloatSampler): FilterCase => {
  const kind = sampleKind(sampler)
  return {
    kind,
    flags: sampleChoice(
      sampler,
      0,
      0x8,
      0x10000,
      0x40000,
      0x40008,
      0x10008,
      0x50000,
      0x2,
      0x84,
      0x18000
    ),
    isCheckpointObject: kind === 0 || sampler.getIsChance(70),
    plane: Array.from({ length: 4 }, () => sampler.sampleUniform(1)),
    progress: sampler.getIsChance(40) ? 0 : sampler.sampleUniform(1),
    normal: Array.from({ length: 3 }, () => sampler.sampleUniform(1)),
    racerFlags: sampleChoice(sampler, 0, 0x80000, 0x1000, 0x80002),
    zones: [
      sampler.sampleIntegerBelow(3),
      sampler.sampleIntegerBelow(3),
      sampler.sampleIntegerBelow(3),
    ],
    lap: sampler.sampleIntegerBelow(5) - 1,
    lapCount: 1 + sampler.sampleIntegerBelow(5),
    currentLap: sampler.sampleIntegerBelow(5),
    side: sampler.sampleIntegerBelow(2),
    identifier: sampler.sampleIntegerBelow(200),
  }
}

const getFilterCall = (precision: EmulatorPrecision, item: FilterCase): EmulatorCall => {
  const body = new Array<EmulatorArgument>(BODY_WORDS).fill(0)
  body[At.racerPointer / 4] = { buffer: 'racer' }
  body[At.eventsPointer / 4] = { buffer: 'events' }
  body[At.checkpointObject / 4] = { buffer: 'checkpointObject' }
  const racer = new Array<EmulatorArgument>(RACER_WORDS).fill(0)
  racer[At.checkpointSide / 4] = item.side
  racer[At.lapCount / 4] = item.lapCount
  racer[At.currentLap / 4] = item.currentLap
  racer[At.flags / 4] = item.racerFlags
  racer[At.zoneCurrent / 4] = item.zones[0] ?? 0
  racer[At.zonePrevious / 4] = item.zones[1] ?? 0
  racer[At.zoneBeforePrevious / 4] = item.zones[2] ?? 0
  racer[At.lap / 4] = item.lap
  const property = new Array<EmulatorArgument>(PROPERTY_WORDS).fill(0)
  if (item.kind === 0) {
    item.plane.slice(0, 3).forEach((value, index) => {
      property[index] = getBitsFromFloat(value)
    })
    property[7] = getBitsFromFloat(item.progress)
  } else {
    property[2] = item.flags
    property[5] = item.identifier
  }
  // The events object holds no event and an empty hazard list (+0x14), so its signal walks do nothing.
  const eventWords = new Array<EmulatorArgument>(0x100 / 4).fill(0)
  eventWords[0x14 / 4] = { buffer: 'hazards' }
  const material = new Array<EmulatorArgument>(MATERIAL_WORDS).fill(0)
  material[5] = item.kind === 2 ? 0 : { buffer: 'property' }
  // The name starts at +0x18: a digit for a checkpoint, a letter otherwise.
  material[6] = item.kind === 0 ? 0x35 : 0x72
  const triangle = new Array<EmulatorArgument>(TRIANGLE_WORDS).fill(0)
  item.normal.forEach((value, index) => {
    triangle[0x24 / 4 + index] = getBitsFromFloat(value)
  })
  return {
    address: FILTER_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [
      { buffer: 'body' },
      { buffer: 'point' },
      { buffer: 'material' },
      item.isCheckpointObject ? { buffer: 'checkpointObject' } : { buffer: 'otherObject' },
      { buffer: 'triangle' },
    ],
    buffers: [
      { name: 'body', words: body, isRead: false },
      { name: 'racer', words: racer, isRead: true },
      { name: 'events', words: eventWords, isRead: false },
      { name: 'hazards', words: new Array<number>(8).fill(0), isRead: false },
      { name: 'checkpointObject', words: new Array<number>(4).fill(0), isRead: false },
      { name: 'otherObject', words: new Array<number>(4).fill(0), isRead: false },
      { name: 'point', words: new Array<number>(3).fill(0), isRead: false },
      { name: 'material', words: material, isRead: false },
      { name: 'property', words: property, isRead: false },
      { name: 'triangle', words: triangle, isRead: false },
    ],
  }
}

const getPortRacer = (item: FilterCase): Racer =>
  Object.freeze({
    ...createFixtureRacer(),
    checkpointIndex: -1,
    checkpointSide: item.side,
    lapCount: item.lapCount,
    currentLap: item.currentLap,
    flags: item.racerFlags,
    zoneCurrent: item.zones[0] ?? 0,
    zonePrevious: item.zones[1] ?? 0,
    zoneBeforePrevious: item.zones[2] ?? 0,
    lap: item.lap,
  })

const getTrackMaterial = (item: FilterCase): TrackMaterial => ({
  name: 'rock',
  flags: item.flags,
  firstInteger: 0,
  secondInteger: 0,
  thirdInteger: item.identifier,
  fourthInteger: 0,
  firstVector: [0, 0, 0],
  secondVector: [0, 0, 0],
  fifthInteger: 0,
  sixthInteger: 0,
  seventhInteger: 0,
  linkedName: null,
  firstFloat: 0,
  secondFloat: 0,
  thirdFloat: 0,
  fourthFloat: 0,
  fifthFloat: 0,
})

const getCheckpoints = (item: FilterCase): readonly Checkpoint[] =>
  Array.from({ length: CHECKPOINT_INDEX + 1 }, () => ({
    plane: [item.plane[0] ?? 0, item.plane[1] ?? 0, item.plane[2] ?? 0, item.plane[3] ?? 0],
    point: [0, 0, 0],
    links: [255, 255, 255, 255],
    progress: item.progress,
  })) as unknown as readonly Checkpoint[]

type FilterResult = {
  readonly isAccepted: boolean
  readonly racer: Racer
  readonly contacts: readonly CarBodyContact[]
}

const getPortResult = (precision: EmulatorPrecision, item: FilterCase): FilterResult => {
  const arithmetic = createFloatArithmetic(precision)
  const surfaces: SurfaceMaterials = {
    trackMaterials: new Map(item.kind === 1 ? [['rock', getTrackMaterial(item)]] : []),
    checkpointIndices: new Map([['5', CHECKPOINT_INDEX]]),
    checkpointObjectIndex: 1,
  }
  const contacts: CarBodyContact[] = []
  const hooks = createCarBodyContactHooks(surfaces, (contact) => void contacts.push(contact))
  const point: Vector3 = { x: 0, y: 0, z: 0 }
  const [normalX, normalY, normalZ] = item.normal as [number, number, number]
  const decision = hooks.decideHullContact({} as never, {
    point,
    material: item.kind === 0 ? '5' : item.kind === 1 ? 'rock' : 'none',
    collisionObjectIndex: item.isCheckpointObject ? 1 : 0,
    triangle: {
      vertices: [point, point, point],
      normal: { x: normalX, y: normalY, z: normalZ },
      planeDistance: 0,
    },
  })
  const racer = contacts.reduce((current, contact) => {
    if (contact.type === 'checkpoint_touched') {
      return getRacerAfterCheckpointContact(
        arithmetic,
        getCheckpoints(item),
        current,
        contact.checkpointIndex,
        contact.direction
      )
    }
    return contact.type === 'finish_touched'
      ? Object.freeze({ ...current, currentLap: current.lapCount })
      : current
  }, getPortRacer(item))
  return { isAccepted: decision.isAccepted, racer, contacts }
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x42a830 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleFilterCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getFilterCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const words = results[index]?.buffers['racer'] ?? []
    const original = {
      isAccepted: (results[index]?.eax ?? 0) !== 0,
      isCheckpointSet: (words[At.checkpointPointer / 4] ?? 0) !== 0,
      side: words[At.checkpointSide / 4],
      currentLap: words[At.currentLap / 4],
      flags: words[At.flags / 4],
      zones: [
        words[At.zoneCurrent / 4],
        words[At.zonePrevious / 4],
        words[At.zoneBeforePrevious / 4],
      ],
      lap: (words[At.lap / 4] ?? 0) | 0,
    }
    const { isAccepted, racer } = getPortResult(precision, item)
    const ported = {
      isAccepted,
      isCheckpointSet: racer.checkpointIndex >= 0,
      side: racer.checkpointSide,
      currentLap: racer.currentLap,
      flags: racer.flags,
      zones: [racer.zoneCurrent, racer.zonePrevious, racer.zoneBeforePrevious],
      lap: racer.lap,
    }
    return JSON.stringify(original) === JSON.stringify(ported)
      ? []
      : [
          `${String(index)}: ${JSON.stringify(original)} against ${JSON.stringify(ported)} for ${JSON.stringify({ kind: item.kind, flags: item.flags, isCheckpointObject: item.isCheckpointObject, lapCount: item.lapCount })}`,
        ]
  })

  // Assert
  expect(mismatches.slice(0, 5)).toEqual([])
}

const SURFACE_ADDRESS = 0x0042a900
const WHEEL_START = 0x198
const WHEEL_SIZE = 0x70
const WHEEL_COUNT = 4
const SURFACE_IGNORED_FLAG = 0x100000
const ENTER_EVENT_ADDRESS = 0x00461ef0
const LEAVE_EVENT_ADDRESS = 0x00462140
const EVENT_TAIL_ADDRESSES = [0x004628c0, 0x004629d0]
const LOG_COUNT_OFFSET = 0xf0
const LEAVE_LOG_MARK = 0x80000000

// The surface kinds a wheel can stand on: nothing, an object without a property entry, or one of three entries.
const SURFACE_NAMES: readonly (string | undefined)[] = [
  undefined,
  'plain',
  'first',
  'second',
  'third',
]
// Flags 0x80 (sound) and 0x400 (emitter) reach presentation code that the port skips.
const SURFACE_FLAG_CHOICES = [0x2, 0x4, 0x40, 0x800, 0x1000, 0x2000, 0x4000, 0x8000]

type SurfaceWheelCase = {
  readonly material: string | undefined
  readonly previousMaterial: string | undefined
  readonly isOnGround: boolean
}

type SurfaceCase = {
  readonly isIgnored: boolean
  readonly wheels: readonly SurfaceWheelCase[]
  readonly entries: ReadonlyMap<string, TrackMaterial>
}

const FALLBACK_ENTRY = getTrackMaterial({ kind: 1, flags: 0 } as FilterCase)

const sampleSurfaceName = (sampler: FloatSampler): string | undefined =>
  SURFACE_NAMES[sampler.sampleIntegerBelow(SURFACE_NAMES.length)]

const sampleSurfaceEntry = (sampler: FloatSampler, name: string): TrackMaterial => ({
  ...getTrackMaterial({
    kind: 1,
    flags: SURFACE_FLAG_CHOICES.reduce(
      (flags, flag) => (sampler.getIsChance(50) ? flags | flag : flags),
      0
    ),
  } as FilterCase),
  name,
  firstInteger: sampler.sampleIntegerBelow(1000) + 1,
  secondInteger: sampler.sampleIntegerBelow(1000) + 1,
  secondVector: [1, 2, 3].map(() => Math.fround(sampler.sampleUniform(10))) as [
    number,
    number,
    number,
  ],
  firstFloat: Math.fround(sampler.sampleUniform(2)),
  secondFloat: Math.fround(sampler.sampleUniform(2)),
  thirdFloat: Math.fround(sampler.sampleUniform(5)),
  fourthFloat: Math.fround(sampler.sampleUniform(2)),
  fifthFloat: Math.fround(sampler.sampleUniform(30)),
})

const sampleSurfaceCase = (sampler: FloatSampler): SurfaceCase => ({
  isIgnored: sampler.getIsChance(25),
  wheels: Array.from({ length: WHEEL_COUNT }, () => ({
    material: sampleSurfaceName(sampler),
    previousMaterial: sampleSurfaceName(sampler),
    isOnGround: sampler.getIsChance(75),
  })),
  entries: new Map(
    ['first', 'second', 'third'].map((name) => [name, sampleSurfaceEntry(sampler, name)])
  ),
})

const getMaterialReference = (name: string | undefined): EmulatorArgument =>
  name === undefined ? 0 : { buffer: `object-${name}` }

const getPropertyWords = (entry: TrackMaterial): readonly EmulatorArgument[] => {
  const words = new Array<EmulatorArgument>(PROPERTY_WORDS).fill(0)
  words[2] = entry.flags
  words[3] = entry.firstInteger
  words[4] = entry.secondInteger
  entry.secondVector.forEach((value, index) => {
    words[0x28 / 4 + index] = getBitsFromFloat(value)
  })
  words[0x48 / 4] = getBitsFromFloat(entry.firstFloat)
  words[0x4c / 4] = getBitsFromFloat(entry.secondFloat)
  words[0x50 / 4] = getBitsFromFloat(entry.thirdFloat)
  words[0x54 / 4] = getBitsFromFloat(entry.fourthFloat)
  words[0x58 / 4] = getBitsFromFloat(entry.fifthFloat)
  return words
}

// mov edx,[ecx+0xf0]; mov eax,[esp+4]; (or eax,0x80000000;) mov [ecx+edx*4+0xf4],eax; inc [ecx+0xf0]; ret 8.
const getLogPatch = (address: number, isLeave: boolean): EmulatorPatch => ({
  address,
  bytes: [
    0x8b,
    0x91,
    LOG_COUNT_OFFSET,
    0,
    0,
    0,
    0x8b,
    0x44,
    0x24,
    0x04,
    ...(isLeave ? [0x0d, 0, 0, 0, 0x80] : []),
    0x89,
    0x84,
    0x91,
    LOG_COUNT_OFFSET + 4,
    0,
    0,
    0,
    0xff,
    0x81,
    LOG_COUNT_OFFSET,
    0,
    0,
    0,
    0xc2,
    8,
    0,
  ],
})

const getSurfaceCall = (precision: EmulatorPrecision, item: SurfaceCase): EmulatorCall => {
  const body = new Array<EmulatorArgument>(BODY_WORDS).fill(0)
  body[At.racerPointer / 4] = { buffer: 'racer' }
  body[At.eventsPointer / 4] = { buffer: 'events' }
  body[0x6c0 / 4] = item.isIgnored ? SURFACE_IGNORED_FLAG : 0
  item.wheels.forEach((wheel, index) => {
    const start = (WHEEL_START + index * WHEEL_SIZE) / 4
    body[start + 0x3c / 4] = getMaterialReference(wheel.material)
    body[start + 0x40 / 4] = getMaterialReference(wheel.previousMaterial)
    body[start + 0x48 / 4] = wheel.isOnGround ? 1 : 0
  })
  const eventWords = new Array<EmulatorArgument>(0x100 / 4).fill(0)
  eventWords[0x14 / 4] = { buffer: 'hazards' }
  const objects = ['plain', 'first', 'second', 'third'].map((name): EmulatorBuffer => ({
    name: `object-${name}`,
    words: Array.from({ length: MATERIAL_WORDS }, (_, index) =>
      index === 5 && name !== 'plain' ? { buffer: `property-${name}` } : 0
    ),
    isRead: false,
  }))
  const properties = ['first', 'second', 'third'].map((name): EmulatorBuffer => ({
    name: `property-${name}`,
    words: getPropertyWords(item.entries.get(name) ?? FALLBACK_ENTRY),
    isRead: false,
  }))
  return {
    address: SURFACE_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'body' }],
    buffers: [
      { name: 'body', words: body, isRead: true },
      { name: 'racer', words: new Array<number>(RACER_WORDS).fill(0), isRead: false },
      { name: 'events', words: eventWords, isRead: true },
      { name: 'hazards', words: new Array<number>(8).fill(0), isRead: false },
      ...objects,
      ...properties,
    ],
    patches: [
      getLogPatch(ENTER_EVENT_ADDRESS, false),
      getLogPatch(LEAVE_EVENT_ADDRESS, true),
      ...EVENT_TAIL_ADDRESSES.map((address) => ({ address, bytes: [0xc2, 8, 0] })),
    ],
  }
}

const getSurfacePortResult = (item: SurfaceCase) => {
  const surfaces: SurfaceMaterials = {
    trackMaterials: item.entries,
    checkpointIndices: new Map(),
    checkpointObjectIndex: -1,
  }
  const log: number[] = []
  const hooks = createCarBodyContactHooks(surfaces, (contact) => {
    if (contact.type === 'surface_entered') log.push(contact.identifier)
    if (contact.type === 'surface_left') log.push(contact.identifier + LEAVE_LOG_MARK)
  })
  const { rigidBody } = createFixtureRacer().carBody
  const body = Object.freeze({
    ...rigidBody,
    flags: item.isIgnored ? SURFACE_IGNORED_FLAG : 0,
    wheels: Object.freeze(
      rigidBody.wheels.map((wheel, index) => ({
        ...wheel,
        ...item.wheels[index],
      }))
    ),
  })
  return { body: hooks.afterPass(body), log }
}

const getWheelSurfaceBits = (wheel: CarWheel): readonly number[] =>
  [
    wheel.surfaceDrag,
    wheel.surfaceGrip,
    wheel.surfaceSkidGrip,
    wheel.grip,
    wheel.surfaceValue60,
    wheel.surfaceForce.x,
    wheel.surfaceForce.y,
    wheel.surfaceForce.z,
  ].map(getBitsFromFloat)

const expectSurfacesMatchOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x42a900 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleSurfaceCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getSurfaceCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const words = results[index]?.buffers['body'] ?? []
    const eventWords = results[index]?.buffers['events'] ?? []
    const logCount = eventWords[LOG_COUNT_OFFSET / 4] ?? 0
    const original = {
      wheels: item.wheels.map((_wheel, wheelIndex) => {
        const start = (WHEEL_START + wheelIndex * WHEEL_SIZE + 0x50) / 4
        return words.slice(start, start + 8)
      }),
      log: eventWords.slice(LOG_COUNT_OFFSET / 4 + 1, LOG_COUNT_OFFSET / 4 + 1 + logCount),
    }
    const ported = getSurfacePortResult(item)
    const comparison = {
      wheels: ported.body.wheels.map(getWheelSurfaceBits),
      log: ported.log,
    }
    return JSON.stringify(original) === JSON.stringify(comparison)
      ? []
      : [`${String(index)}: ${JSON.stringify(original)} against ${JSON.stringify(comparison)}`]
  })

  // Assert
  expect(mismatches.slice(0, 3)).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())(
  'the car body contact hooks against the original',
  () => {
    it.each(PRECISIONS)(
      '0x0042a830 matches the original in %s precision',
      (precision) => expectMatchesOriginal(precision),
      TEST_TIMEOUT_IN_MILLISECONDS
    )

    it.each(PRECISIONS)(
      '0x0042a900 matches the original in %s precision',
      (precision) => expectSurfacesMatchOriginal(precision),
      TEST_TIMEOUT_IN_MILLISECONDS
    )
  }
)

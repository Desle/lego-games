import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
  EmulatorPatch,
} from '../../../../shared/emulator/emulator-client.types.ts'
import {
  formatBits,
  getBitsFromFloat,
  getIsSameFloatBits,
} from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import type { ProjectileTrail, TrailRing } from '../../types/projectile-trail.types.ts'
import { pushTrailRing, stepTrailPool } from './projectile-trails.ts'
import type { TrailPool } from '../../types/projectile-trail.types.ts'

const PUSH_ADDRESS = 0x00492ee0
const UPDATE_ADDRESS = 0x00492be0
const CASE_COUNT = 700
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const TRAIL_WORDS = 0x2a4 / 4
const SLOT_BASE = 0xdc
const SLOT_SIZE = 0x4c
// The first buffer of a call starts at the scratch heap's base, so the stubs write their logs to fixed addresses.
const LOG_BASE = 0x20000000
const POSITION_OFFSET = 0
const COORDINATE_OFFSET = 0x600
const COLOR_OFFSET = 0x1000
const ORIGIN_OFFSET = 0x1200
const INDEX_OFFSET = 0x1400
const DRAW_LIST_OFFSET = 0x1600
const LOG_WORDS = 0x1700 / 4
const MAXIMUM_VERTICES = 0x6a
const MAXIMUM_TRIANGLES = 0x35
// Free code in the emulator's stub page.
const POSITION_STUB = 0x7e00fc80
const COORDINATE_STUB = 0x7e00fcc0
const COLOR_STUB = 0x7e00fd00
const LOCK_VERTICES_STUB = 0x7e00fd40
const UNLOCK_TWO_STUB = 0x7e00fd80
const LOCK_INDICES_STUB = 0x7e00fdc0
const UNLOCK_ONE_STUB = 0x7e00fe00
const ORIGIN_STUB = 0x7e00fe40
const FLAG_BIT_FOUR = 4

const getAddressBytes = (address: number): readonly number[] => [
  address & 0xff,
  (address >>> 8) & 0xff,
  (address >>> 16) & 0xff,
  (address >>> 24) & 0xff,
]

// Each stub stores what the mesh's setters are given into the log and returns like the original callee does.
const getStorePointedWord = (
  modifier: number,
  base: number,
  wordOffset: number
): readonly number[] => [
  ...(wordOffset === 0 ? [0x8b, 0x0a] : [0x8b, 0x4a, wordOffset]),
  0x89,
  0x0c,
  modifier,
  ...getAddressBytes(base + wordOffset),
]
const FETCH_ARGUMENTS = [0x8b, 0x44, 0x24, 0x04, 0x8b, 0x54, 0x24, 0x08]
const SCALE_FOUR = 0x85
const SCALE_EIGHT = 0xc5

const PATCHES: readonly EmulatorPatch[] = [
  {
    address: POSITION_STUB,
    bytes: [
      ...FETCH_ARGUMENTS,
      0x8d,
      0x04,
      0x40,
      ...getStorePointedWord(SCALE_FOUR, LOG_BASE + POSITION_OFFSET, 0),
      ...getStorePointedWord(SCALE_FOUR, LOG_BASE + POSITION_OFFSET, 4),
      ...getStorePointedWord(SCALE_FOUR, LOG_BASE + POSITION_OFFSET, 8),
      0xc2,
      8,
      0,
    ],
  },
  {
    address: COORDINATE_STUB,
    bytes: [
      ...FETCH_ARGUMENTS,
      ...getStorePointedWord(SCALE_EIGHT, LOG_BASE + COORDINATE_OFFSET, 0),
      ...getStorePointedWord(SCALE_EIGHT, LOG_BASE + COORDINATE_OFFSET, 4),
      0xc2,
      8,
      0,
    ],
  },
  {
    address: COLOR_STUB,
    bytes: [
      ...FETCH_ARGUMENTS,
      ...getStorePointedWord(SCALE_FOUR, LOG_BASE + COLOR_OFFSET, 0),
      0xc2,
      8,
      0,
    ],
  },
  {
    address: LOCK_VERTICES_STUB,
    bytes: [0x8b, 0x44, 0x24, 0x04, 0x8b, 0x51, 0x40, 0x89, 0x10, 0xc2, 4, 0],
  },
  { address: UNLOCK_TWO_STUB, bytes: [0xc2, 8, 0] },
  {
    address: LOCK_INDICES_STUB,
    bytes: [0x8b, 0x44, 0x24, 0x04, 0x8b, 0x51, 0x44, 0x89, 0x10, 0xc2, 4, 0],
  },
  { address: UNLOCK_ONE_STUB, bytes: [0xc2, 4, 0] },
  {
    address: ORIGIN_STUB,
    bytes: [
      0x8b,
      0x54,
      0x24,
      0x04,
      ...[0, 4, 8].flatMap((offset) => [
        ...(offset === 0 ? [0x8b, 0x02] : [0x8b, 0x42, offset]),
        0xa3,
        ...getAddressBytes(LOG_BASE + ORIGIN_OFFSET + offset),
      ]),
      0xc2,
      4,
      0,
    ],
  },
]

type SlotCase = {
  readonly milliseconds: number
  readonly points: readonly number[]
  readonly center: readonly number[]
}

type TrailCase = {
  readonly flags: number
  readonly ringSize: number
  readonly verticesPerRing: number
  readonly sliceMilliseconds: number
  readonly writeIndex: number
  readonly readIndex: number
  readonly fadeFactor: number
  readonly alphaReduction: number
  readonly color: readonly number[]
  readonly slots: readonly SlotCase[]
  readonly milliseconds: number
  readonly ring: readonly number[]
  readonly ringCenter: readonly number[]
}

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleFloats = (sampler: FloatSampler, count: number, limit: number): readonly number[] =>
  Array.from({ length: count }, () => Math.fround(sampler.sampleUniform(limit)))

const sampleTrailCase = (sampler: FloatSampler): TrailCase => {
  const ringSize = sampleChoice(sampler, 2, 3, 4, 4, 4)
  const verticesPerRing = sampleChoice(sampler, 3, 4, 4, 4, 5)
  const sliceMilliseconds = sampleChoice(sampler, 1, 2, 25, 75, 100, 150)
  const slotCount = ringSize + 2
  const isAwaiting = sampler.getIsChance(15)
  const flags =
    1 |
    (isAwaiting ? 8 : 0) |
    (sampler.getIsChance(50) ? 2 : 0) |
    (sampler.getIsChance(50) ? 0x10 : 0) |
    (sampler.getIsChance(60) ? 0x20 : 0) |
    FLAG_BIT_FOUR
  return {
    flags,
    ringSize,
    verticesPerRing,
    sliceMilliseconds,
    writeIndex: isAwaiting ? sampler.sampleIntegerBelow(2) : sampler.sampleIntegerBelow(slotCount),
    readIndex: sampler.sampleIntegerBelow(slotCount),
    fadeFactor: Math.fround(sampleChoice(sampler, 0.1, 1, 0, 0.5, 0.9)),
    alphaReduction: Math.fround(sampleChoice(sampler, 0, 0, 0.3, 1.1, 0.7)),
    color: [
      sampler.sampleIntegerBelow(256),
      sampler.sampleIntegerBelow(256),
      sampler.sampleIntegerBelow(256),
      sampleChoice(sampler, 200, 255, 50, sampler.sampleIntegerBelow(256)),
    ],
    slots: Array.from({ length: slotCount }, () => ({
      milliseconds: sampleChoice(
        sampler,
        0,
        sliceMilliseconds,
        sampler.sampleIntegerBelow(sliceMilliseconds + 1),
        sampler.sampleIntegerBelow(sliceMilliseconds + 1),
        sliceMilliseconds + 3
      ),
      points: sampleFloats(sampler, verticesPerRing * 3, 800),
      center: sampleFloats(sampler, 3, 800),
    })),
    milliseconds: sampleChoice(
      sampler,
      0,
      1,
      5,
      sliceMilliseconds - 1,
      sliceMilliseconds,
      sliceMilliseconds + 1,
      sliceMilliseconds * 2 + 3,
      1 + sampler.sampleIntegerBelow(400)
    ),
    ring: sampleFloats(sampler, verticesPerRing * 3, 800),
    ringCenter: sampleFloats(sampler, 3, 800),
  }
}

const getFloatWords = (values: readonly number[]): readonly number[] => values.map(getBitsFromFloat)

const buildWords = (
  length: number,
  entries: readonly (readonly [number, EmulatorArgument])[]
): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getTrailWords = (item: TrailCase): readonly EmulatorArgument[] => {
  const entries: (readonly [number, EmulatorArgument])[] = [
    [2, { buffer: 'mesh' }],
    [3, { buffer: 'frameVtable' }],
    [0x9c / 4, item.flags],
    [0xa0 / 4, item.ringSize * item.sliceMilliseconds],
    [0xa4 / 4, item.sliceMilliseconds],
    [0xa8 / 4, item.writeIndex],
    [0xac / 4, item.readIndex],
    [0xb4 / 4, item.ringSize],
    [0xb8 / 4, item.ringSize + 2],
    [0xbc / 4, item.verticesPerRing],
    [0xd0 / 4, getBitsFromFloat(item.fadeFactor)],
    [0xd4 / 4, getBitsFromFloat(item.alphaReduction)],
    [
      0xd8 / 4,
      (item.color[0] ?? 0) |
        ((item.color[1] ?? 0) << 8) |
        ((item.color[2] ?? 0) << 16) |
        ((item.color[3] ?? 0) << 24),
    ],
  ]
  item.slots.forEach((slot, index) => {
    const base = (SLOT_BASE + index * SLOT_SIZE) / 4
    entries.push([base, slot.milliseconds])
    getFloatWords(slot.points).forEach((bits, position) =>
      entries.push([base + 1 + position, bits])
    )
    getFloatWords(slot.center).forEach((bits, position) =>
      entries.push([base + 16 + position, bits])
    )
  })
  return buildWords(TRAIL_WORDS, entries)
}

const getCall = (address: number, item: TrailCase): EmulatorCall => ({
  address,
  convention: 'thiscall',
  precision: 'single',
  arguments:
    address === PUSH_ADDRESS
      ? [
          { buffer: 'trail' },
          item.milliseconds,
          { buffer: 'ring' },
          ...getFloatWords(item.ringCenter),
        ]
      : [{ buffer: 'trail' }, item.milliseconds],
  buffers: [
    { name: 'log', words: buildWords(LOG_WORDS, []), isRead: true },
    { name: 'trail', words: getTrailWords(item), isRead: true },
    { name: 'ring', words: getFloatWords(item.ring), isRead: false },
    {
      name: 'mesh',
      words: buildWords(0x48 / 4, [
        [0, { buffer: 'meshVtable' }],
        [0x24 / 4, { buffer: 'log', offset: DRAW_LIST_OFFSET }],
        [0x40 / 4, { buffer: 'vertexObject' }],
        [0x44 / 4, { buffer: 'indexObject' }],
      ]),
      isRead: false,
    },
    {
      name: 'meshVtable',
      words: buildWords(0x60 / 4, [
        [0x28 / 4, LOCK_VERTICES_STUB],
        [0x2c / 4, UNLOCK_TWO_STUB],
        [0x30 / 4, LOCK_INDICES_STUB],
        [0x34 / 4, UNLOCK_ONE_STUB],
      ]),
      isRead: false,
    },
    {
      name: 'vertexObject',
      words: buildWords(4, [[0, { buffer: 'vertexVtable' }]]),
      isRead: false,
    },
    {
      name: 'vertexVtable',
      words: buildWords(0x40 / 4, [
        [0x24 / 4, POSITION_STUB],
        [0x28 / 4, COORDINATE_STUB],
        [0x30 / 4, COLOR_STUB],
      ]),
      isRead: false,
    },
    {
      name: 'indexObject',
      words: buildWords(4, [[2, { buffer: 'log', offset: INDEX_OFFSET }]]),
      isRead: false,
    },
    { name: 'frameVtable', words: buildWords(4, [[2, ORIGIN_STUB]]), isRead: false },
  ],
  patches: PATCHES,
})

const getPortTrail = (item: TrailCase): ProjectileTrail => ({
  isActive: true,
  isReleasing: (item.flags & 2) !== 0,
  isAwaitingFirstRing: (item.flags & 8) !== 0,
  isAgeing: (item.flags & 0x10) !== 0,
  isBuilt: (item.flags & 0x20) !== 0,
  durationMilliseconds: item.ringSize * item.sliceMilliseconds,
  sliceMilliseconds: item.sliceMilliseconds,
  writeIndex: item.writeIndex,
  readIndex: item.readIndex,
  ringSize: item.ringSize,
  slotCount: item.ringSize + 2,
  verticesPerRing: item.verticesPerRing,
  fadeFactor: item.fadeFactor,
  alphaReduction: item.alphaReduction,
  color: {
    red: item.color[0] ?? 0,
    green: item.color[1] ?? 0,
    blue: item.color[2] ?? 0,
    alpha: item.color[3] ?? 0,
  },
  materialName: 'trail',
  slots: item.slots.map((slot) => ({
    milliseconds: slot.milliseconds,
    vertices: Array.from({ length: item.verticesPerRing }, (_, index) => ({
      x: slot.points[index * 3] ?? 0,
      y: slot.points[index * 3 + 1] ?? 0,
      z: slot.points[index * 3 + 2] ?? 0,
    })),
    center: { x: slot.center[0] ?? 0, y: slot.center[1] ?? 0, z: slot.center[2] ?? 0 },
  })),
  mesh: null,
})

const getPortRing = (item: TrailCase): TrailRing => ({
  vertices: Array.from({ length: item.verticesPerRing }, (_, index) => ({
    x: item.ring[index * 3] ?? 0,
    y: item.ring[index * 3 + 1] ?? 0,
    z: item.ring[index * 3 + 2] ?? 0,
  })),
  center: { x: item.ringCenter[0] ?? 0, y: item.ringCenter[1] ?? 0, z: item.ringCenter[2] ?? 0 },
})

const getFlagsByte = (trail: ProjectileTrail): number =>
  (trail.isActive ? 1 : 0) |
  (trail.isReleasing ? 2 : 0) |
  (trail.isAwaitingFirstRing ? 8 : 0) |
  (trail.isAgeing ? 0x10 : 0) |
  (trail.isBuilt ? 0x20 : 0)

// What both sides are compared on: the flags without the unused bit 4, the indices, and the slots (while the trail lives).
const getPortWords = (trail: ProjectileTrail, isLive: boolean): readonly number[] => [
  getFlagsByte(trail),
  ...(isLive
    ? [
        trail.writeIndex,
        trail.readIndex,
        ...trail.slots.flatMap((slot) => [
          slot.milliseconds,
          ...slot.vertices.flatMap((point) => getFloatWords([point.x, point.y, point.z])),
          ...getFloatWords([slot.center.x, slot.center.y, slot.center.z]),
        ]),
      ]
    : []),
]

const getOriginalWords = (
  trailWords: readonly number[],
  verticesPerRing: number,
  isLive: boolean
): readonly number[] => [
  (trailWords[0x9c / 4] ?? 0) & 0xfb & 0xff,
  ...(isLive
    ? [
        trailWords[0xa8 / 4] ?? 0,
        trailWords[0xac / 4] ?? 0,
        ...Array.from({ length: trailWords[0xb8 / 4] ?? 0 }, (_, slot) => {
          const base = (SLOT_BASE + slot * SLOT_SIZE) / 4
          return [
            trailWords[base] ?? 0,
            ...Array.from(
              { length: verticesPerRing * 3 },
              (_unused, word) => trailWords[base + 1 + word] ?? 0
            ),
            ...[0, 1, 2].map((word) => trailWords[base + 16 + word] ?? 0),
          ]
        }).flat(),
      ]
    : []),
]

const getMeshWords = (trail: ProjectileTrail | null): readonly number[] => {
  const log = new Array<number>(LOG_WORDS).fill(0)
  const mesh = trail === null ? null : trail.mesh
  if (mesh === null) return log
  mesh.vertices.slice(0, MAXIMUM_VERTICES).forEach((vertex, index) => {
    const position = [vertex.position.x, vertex.position.y, vertex.position.z]
    getFloatWords(position).forEach(
      (bits, word) => (log[POSITION_OFFSET / 4 + index * 3 + word] = bits)
    )
    getFloatWords([vertex.u, vertex.v]).forEach(
      (bits, word) => (log[COORDINATE_OFFSET / 4 + index * 2 + word] = bits)
    )
    log[COLOR_OFFSET / 4 + index] =
      (vertex.color.red |
        (vertex.color.green << 8) |
        (vertex.color.blue << 16) |
        (vertex.color.alpha << 24)) >>>
      0
  })
  getFloatWords([mesh.origin.x, mesh.origin.y, mesh.origin.z]).forEach(
    (bits, word) => (log[ORIGIN_OFFSET / 4 + word] = bits)
  )
  mesh.triangles.slice(0, MAXIMUM_TRIANGLES).forEach((triangle, index) => {
    log[INDEX_OFFSET / 4 + index] = triangle.first | (triangle.second << 8) | (triangle.third << 16)
  })
  return log
}

const getOriginalMeshWords = (log: readonly number[]): readonly number[] =>
  log.slice(0, DRAW_LIST_OFFSET / 4)

const getPoolOf = (trail: ProjectileTrail): TrailPool => ({ trails: [trail] })

const getPortResult = (address: number, item: TrailCase): ProjectileTrail | null => {
  const pool = getPoolOf(getPortTrail(item))
  const after =
    address === PUSH_ADDRESS
      ? pushTrailRing(pool, 0, item.milliseconds, getPortRing(item))
      : stepTrailPool(pool, item.milliseconds)
  return after.trails[0] ?? null
}

const expectMatchesOriginal = async (address: number): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(address))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleTrailCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getCall(address, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const trail = getPortResult(address, item)
    const result = results[index]
    if (trail === null || result === undefined) return [`${String(index)}: no result`]
    const trailWords = result.buffers['trail'] ?? []
    const isLive = true
    const original = [
      ...getOriginalWords(trailWords, item.verticesPerRing, isLive),
      ...getOriginalMeshWords(result.buffers['log'] ?? []),
    ]
    const ported = [
      ...getPortWords(trail, isLive),
      ...getMeshWords(trail).slice(0, DRAW_LIST_OFFSET / 4),
    ]
    const position = original.findIndex(
      (bits, word) => !getIsSameFloatBits(bits >>> 0, (ported[word] ?? 0) >>> 0)
    )
    return position < 0 && original.length === ported.length
      ? []
      : [
          `${String(index)}: words ${original.flatMap((b, w) => (getIsSameFloatBits(b >>> 0, (ported[w] ?? 0) >>> 0) ? [] : [w])).join()} first ${String(position)} ${formatBits((original[position] ?? 0) >>> 0)} against ${formatBits((ported[position] ?? 0) >>> 0)} (${JSON.stringify(item).slice(0, 300)})`,
        ]
  })

  // Assert
  expect(mismatches.slice(0, 5)).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('the projectile trail against the original', () => {
  it(
    '0x00492ee0 pushes a ring and builds the mesh like the original, bit for bit',
    () => expectMatchesOriginal(PUSH_ADDRESS),
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it(
    '0x00492be0 ages a released trail and builds the mesh like the original, bit for bit',
    () => expectMatchesOriginal(UPDATE_ADDRESS),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
})

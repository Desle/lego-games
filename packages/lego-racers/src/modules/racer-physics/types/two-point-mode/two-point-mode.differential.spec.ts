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
import { getBitsFromFloat, getIsSameFloatBits } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import type {
  CollisionObject,
  CollisionVolume,
  SegmentQueryResult,
} from '../../../collision/index.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import { createCarRigidBody } from '../car-rigid-body/car-rigid-body.ts'
import type { CarRigidBody, CarWheel, SegmentQuery } from '../racer-physics.types.ts'
import {
  getBodyWithTwoPointOffsets,
  getBodyWithTwoPointTargetTilt,
  probeTwoPoints,
} from './two-point-mode.ts'

const OFFSETS_ADDRESS = 0x004464a0
const TARGET_TILT_ADDRESS = 0x00448840
const PROBE_ADDRESS = 0x004465c0
const QUERY_ADDRESS = 0x00403fa0
const FRAME_VTABLE = 0x004af700
const BODY_WORDS = 0x888 / 4
const FRAME_WORDS = 0x80 / 4
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
// The emulator hands out buffers in the order they are listed from here, so the first one starts at this address.
const FIRST_BUFFER_ADDRESS = 0x20000000

// Byte offsets in the car rigid body (physics.md).
const At = Object.freeze({
  physicsFrame: 0x04,
  linearVelocity: 0x08,
  angularVelocity: 0x98,
  embeddedFrame: 0xe4,
  frameRotation: 0x10c,
  framePosition: 0x130,
  displayFrame: 0x13c,
  trackObject: 0x140,
  objectList: 0x144,
  objectCount: 0x154,
  weight: 0x164,
  groundNormal: 0x174,
  slopeForce: 0x180,
  wheels: 0x198,
  localWheelAnchor: 0x358,
  trackWidth: 0x364,
  wheelbase: 0x368,
  groundedWheelCount: 0x36c,
  triangleCache: 0x3f4,
  triangleCount: 0x5d4,
  twoPointHeight: 0x658,
  twoPointTargetHeight: 0x65c,
  twoPointHeightRate: 0x660,
  twoPointPositions: 0x664,
  twoPointTargetTilt: 0x67c,
  twoPointTilt: 0x680,
  stepStartPositionZ: 0x698,
  turnRadius: 0x64c,
  flags: 0x6c0,
})
const WHEEL_SIZE = 0x70
const CACHE_ENTRY_SIZE = 0x3c
const WHEEL_COUNT = 4
const MATERIAL_NAMES = Array.from({ length: 16 }, (_, index) => `m${String(index)}`)

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const getFloatWords = (values: readonly number[]): readonly number[] => values.map(getBitsFromFloat)

const getMatrix = (sampler: FloatSampler): readonly number[] =>
  Array.from({ length: 9 }, () => Math.fround(sampler.sampleUniform(1)))

describe.skipIf(!getIsEmulatorAvailable())('the two-point mode against the original', () => {
  it.each(PRECISIONS)(
    '0x004464a0 matches the original bit for bit in %s precision',
    async (precision) => {
      // Arrange
      const arithmetic = createFloatArithmetic(precision)
      const sampler = createFloatSampler(createSeededRandom(OFFSETS_ADDRESS + precision.length))
      const cases = Array.from({ length: CASE_COUNT }, () => ({
        height: sampler.sampleUniform(10),
        targetHeight: sampler.getIsChance(20) ? 0 : sampler.sampleUniform(10),
        rate: sampler.sampleUniform(5000),
        tilt: sampler.sampleUniform(1),
        targetTilt: sampler.getIsChance(20) ? 0 : sampler.sampleUniform(1),
        step: sampleChoice(sampler, 0, 1, 16, 33, 40, sampler.sampleIntegerBelow(500)),
      }))
      const calls = cases.map((item): EmulatorCall => {
        const words = new Array<EmulatorArgument>(BODY_WORDS).fill(0)
        words[At.twoPointHeight / 4] = getBitsFromFloat(item.height)
        words[At.twoPointTargetHeight / 4] = getBitsFromFloat(item.targetHeight)
        words[At.twoPointHeightRate / 4] = getBitsFromFloat(item.rate)
        words[At.twoPointTilt / 4] = getBitsFromFloat(item.tilt)
        words[At.twoPointTargetTilt / 4] = getBitsFromFloat(item.targetTilt)
        return {
          address: OFFSETS_ADDRESS,
          convention: 'thiscall',
          precision,
          arguments: [{ buffer: 'body' }, item.step],
          buffers: [{ name: 'body', words, isRead: true }],
        }
      })
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(calls)
      await session.close()
      const mismatches = cases.flatMap((item, index) => {
        const moved = getBodyWithTwoPointOffsets(
          arithmetic,
          Object.freeze({
            ...getBlankBody(),
            twoPointHeight: item.height,
            twoPointTargetHeight: item.targetHeight,
            twoPointHeightRate: item.rate,
            twoPointTilt: item.tilt,
            twoPointTargetTilt: item.targetTilt,
          }),
          item.step
        )
        const words = results[index]?.buffers['body'] ?? []
        const isSame =
          getIsSameFloatBits(
            words[At.twoPointHeight / 4] ?? 0,
            getBitsFromFloat(moved.twoPointHeight)
          ) &&
          getIsSameFloatBits(words[At.twoPointTilt / 4] ?? 0, getBitsFromFloat(moved.twoPointTilt))
        return isSame ? [] : [index]
      })

      // Assert
      expect(mismatches).toEqual([])
    },
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it.each(PRECISIONS)(
    '0x00448840 matches the original bit for bit in %s precision',
    async (precision) => {
      // Arrange
      const arithmetic = createFloatArithmetic(precision)
      const sampler = createFloatSampler(createSeededRandom(TARGET_TILT_ADDRESS + precision.length))
      const radii = Array.from({ length: CASE_COUNT }, () =>
        Math.fround(
          sampleChoice(
            sampler,
            0,
            sampler.sampleUniform(5000),
            -sampler.sampleUniform(5000),
            sampler.sampleUniform(50),
            4096,
            -4096,
            sampler.sampleMagnitude()
          )
        )
      )
      const calls = radii.map((radius): EmulatorCall => ({
        address: TARGET_TILT_ADDRESS,
        convention: 'thiscall',
        precision,
        arguments: [{ buffer: 'body' }],
        buffers: [
          {
            name: 'body',
            words: Array.from({ length: BODY_WORDS }, (_, index) =>
              index === At.turnRadius / 4 ? getBitsFromFloat(radius) : 0
            ),
            isRead: true,
          },
        ],
      }))
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(calls)
      await session.close()
      const mismatches = radii.flatMap((radius, index) => {
        const tilted = getBodyWithTwoPointTargetTilt(
          arithmetic,
          Object.freeze({ ...getBlankBody(), turnRadius: radius })
        )
        const original = results[index]?.buffers['body']?.[At.twoPointTargetTilt / 4] ?? 0
        return getIsSameFloatBits(original, getBitsFromFloat(tilted.twoPointTargetTilt))
          ? []
          : [index]
      })

      // Assert
      expect(mismatches).toEqual([])
    },
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it.each(PRECISIONS)(
    '0x004465c0 matches the original bit for bit in %s precision',
    (precision) => expectProbeMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
})

const getBlankBody = (): CarRigidBody =>
  createCarRigidBody(createFloatArithmetic('double'), {
    displayFrame: {
      rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      position: { x: 0, y: 0, z: 0 },
    },
    displayBoundingRadius: 5,
    mass: 1000,
    dimensions: { x: 1, y: 1, z: 1 },
  })

// What the stubbed segment query (0x00403fa0) answers for one call: nothing, a crossing without a triangle, or a hit.
type QueryAnswer = {
  readonly mode: 0 | 1 | 2
  readonly crossing: readonly number[]
  readonly material: number
  readonly triangle: readonly number[]
}

type CachedTriangle = {
  readonly triangle: readonly number[]
  readonly age: number
  readonly material: number
}

type ProbeCase = {
  readonly flags: number
  readonly rotation: readonly number[]
  readonly position: readonly number[]
  readonly stepStartZ: number
  readonly velocity: readonly number[]
  readonly angularVelocity: readonly number[]
  readonly radius: number
  readonly height: number
  readonly weight: number
  readonly localWheelAnchor: readonly number[]
  readonly trackWidth: number
  readonly wheelbase: number
  readonly groundedWheelCount: number
  readonly wheelMaterials: readonly number[]
  readonly wheelFlags: readonly number[]
  readonly wheelCacheIndices: readonly number[]
  readonly cache: readonly CachedTriangle[]
  readonly objects: readonly {
    readonly rotation: readonly number[]
    readonly position: readonly number[]
    readonly answers: readonly QueryAnswer[]
  }[]
  readonly trackAnswers: readonly QueryAnswer[]
  readonly step: number
  readonly groundNormal: readonly number[]
}

const sampleTriangle = (sampler: FloatSampler, height: number): readonly number[] => {
  const normal = [sampler.sampleUniform(0.4), sampler.sampleUniform(0.4), 1]
  const length = Math.hypot(...normal)
  const unit = normal.map((value) => value / length)
  const vertices = [
    [-5000, -5000, height],
    [5000, -5000, height],
    [0, 5000, height],
  ]
  const distance = -(
    (vertices[0]?.[0] ?? 0) * (unit[0] ?? 0) +
    (vertices[0]?.[1] ?? 0) * (unit[1] ?? 0) +
    height * (unit[2] ?? 0)
  )
  return [...vertices.flat(), ...unit, distance].map(Math.fround)
}

const sampleAnswer = (sampler: FloatSampler, centre: readonly number[]): QueryAnswer => ({
  mode: sampleChoice(sampler, 0, 1, 1, 1, 2) as 0 | 1 | 2,
  crossing: centre.map((value) => Math.fround(value + sampler.sampleUniform(3))),
  material: 1 + sampler.sampleIntegerBelow(9),
  triangle: sampleTriangle(sampler, Math.fround((centre[2] ?? 0) + sampler.sampleUniform(3))),
})

const sampleProbeCase = (sampler: FloatSampler): ProbeCase => {
  const position = sampler.sampleList(3, 300).map(Math.fround)
  const cacheCount = sampleChoice(sampler, 0, 0, 1, 2, 3, 8)
  const objectCount = sampleChoice(sampler, 0, 0, 1, 2)
  return {
    flags: sampleChoice(sampler, 0x8, 0x8, 0x8, 0x108, 0x88, 0x9),
    rotation: getMatrix(sampler),
    position,
    stepStartZ: Math.fround(
      (position[2] ?? 0) + sampler.sampleUniform(sampleChoice(sampler, 0.5, 5))
    ),
    velocity: sampler.getIsChance(15) ? [0, 0, 0] : sampler.sampleList(3, 2).map(Math.fround),
    angularVelocity: sampler.getIsChance(60)
      ? [0, 0, 0]
      : sampler.sampleList(3, 2).map(Math.fround),
    radius: Math.fround(Math.abs(sampler.sampleUniform(8))),
    height: sampler.getIsChance(50) ? 0 : Math.fround(sampler.sampleUniform(6)),
    weight: Math.fround(-sampler.sampleUniform(40)),
    localWheelAnchor: sampler.sampleList(3, 3).map(Math.fround),
    trackWidth: Math.fround(sampler.sampleUniform(3)),
    wheelbase: Math.fround(sampler.sampleUniform(5)),
    groundedWheelCount: sampleChoice(sampler, 0, 0, 1, 2, 3, 4),
    wheelMaterials: Array.from({ length: WHEEL_COUNT }, () => sampler.sampleIntegerBelow(10)),
    wheelFlags: Array.from({ length: WHEEL_COUNT }, () => sampler.sampleIntegerBelow(8)),
    wheelCacheIndices: Array.from({ length: WHEEL_COUNT }, () =>
      cacheCount === 0 || sampler.getIsChance(50) ? -1 : sampler.sampleIntegerBelow(cacheCount)
    ),
    cache: Array.from({ length: cacheCount }, () => ({
      triangle: sampleTriangle(sampler, Math.fround((position[2] ?? 0) + sampler.sampleUniform(6))),
      age: sampler.sampleIntegerBelow(20),
      material: 1 + sampler.sampleIntegerBelow(9),
    })),
    objects: Array.from({ length: objectCount }, () => ({
      rotation: getMatrix(sampler),
      position: sampler.sampleList(3, 100).map(Math.fround),
      answers: Array.from({ length: 2 }, () => sampleAnswer(sampler, position)),
    })),
    trackAnswers: Array.from({ length: 2 }, () => sampleAnswer(sampler, position)),
    step: sampleChoice(sampler, 1, 16, 33, 40, 5),
    groundNormal: sampler.sampleList(3, 1).map(Math.fround),
  }
}

const getFrameWords = (
  rotation: readonly number[],
  position: readonly number[]
): EmulatorArgument[] => {
  const words = new Array<EmulatorArgument>(FRAME_WORDS).fill(0)
  words[0] = FRAME_VTABLE
  getFloatWords(rotation).forEach((word, index) => {
    words[0x28 / 4 + index] = word
  })
  getFloatWords(position).forEach((word, index) => {
    words[0x4c / 4 + index] = word
  })
  return words
}

const getVolumeBuffer = (name: string, answers: readonly QueryAnswer[]): EmulatorBuffer => {
  const words = new Array<number>((0x100 + answers.length * 0x80) / 4).fill(0)
  answers.forEach((answer, index) => {
    const start = (0x100 + index * 0x80) / 4
    words[start] = answer.mode
    getFloatWords(answer.crossing).forEach((word, component) => {
      words[start + 1 + component] = word
    })
    words[start + 4] = answer.material
    getFloatWords(answer.triangle).forEach((word, component) => {
      words[start + 8 + component] = word
    })
  })
  return { name, words, isRead: false }
}

// The query's entry is replaced by hand-assembled code (clang, intel syntax): it answers with the table of the volume
// it is called on, one record of 0x80 bytes per call: mode (0 miss, 1 hit, 2 miss with a crossing), crossing point,
// material, then the 13-float triangle.
const QUERY_STUB: EmulatorPatch = {
  address: QUERY_ADDRESS,
  bytes: [
    0x56, 0x57, 0x8b, 0x01, 0xff, 0x01, 0xc1, 0xe0, 0x07, 0x8d, 0xb4, 0x01, 0x00, 0x01, 0x00, 0x00,
    0x8b, 0x06, 0x85, 0xc0, 0x74, 0x3f, 0x8b, 0x7c, 0x24, 0x18, 0x8b, 0x56, 0x04, 0x89, 0x17, 0x8b,
    0x56, 0x08, 0x89, 0x57, 0x04, 0x8b, 0x56, 0x0c, 0x89, 0x57, 0x08, 0x83, 0xf8, 0x01, 0x75, 0x25,
    0x8b, 0x7c, 0x24, 0x14, 0x8d, 0x76, 0x20, 0xb9, 0x0d, 0x00, 0x00, 0x00, 0xf3, 0xa5, 0x8b, 0x56,
    0xbc, 0x8b, 0x7c, 0x24, 0x1c, 0x85, 0xff, 0x74, 0x02, 0x89, 0x17, 0xb8, 0x01, 0x00, 0x00, 0x00,
    0x5f, 0x5e, 0xc2, 0x18, 0x00, 0x31, 0xc0, 0x5f, 0x5e, 0xc2, 0x18, 0x00,
  ],
}

const getProbeCall = (precision: EmulatorPrecision, item: ProbeCase): EmulatorCall => {
  const body = new Array<EmulatorArgument>(BODY_WORDS).fill(0)
  const setFloats = (offset: number, values: readonly number[]): void =>
    getFloatWords(values).forEach((word, index) => {
      body[offset / 4 + index] = word
    })
  body[At.physicsFrame / 4] = { buffer: 'body', offset: At.embeddedFrame }
  body[At.embeddedFrame / 4] = FRAME_VTABLE
  setFloats(At.frameRotation, item.rotation)
  setFloats(At.framePosition, item.position)
  setFloats(At.linearVelocity, item.velocity)
  setFloats(At.angularVelocity, item.angularVelocity)
  body[At.displayFrame / 4] = { buffer: 'display' }
  body[At.trackObject / 4] = { buffer: 'track' }
  body[At.objectCount / 4] = item.objects.length + 1
  item.objects.forEach((_object, index) => {
    body[At.objectList / 4 + index] = { buffer: `object${String(index)}` }
  })
  setFloats(At.weight, [item.weight])
  setFloats(At.groundNormal, item.groundNormal)
  setFloats(At.localWheelAnchor, item.localWheelAnchor)
  setFloats(At.trackWidth, [item.trackWidth])
  setFloats(At.wheelbase, [item.wheelbase])
  body[At.groundedWheelCount / 4] = item.groundedWheelCount
  body[At.triangleCount / 4] = item.cache.length
  item.cache.forEach((cached, index) => {
    const start = (At.triangleCache + index * CACHE_ENTRY_SIZE) / 4
    getFloatWords(cached.triangle).forEach((word, component) => {
      body[start + component] = word
    })
    body[start + 0xd] = cached.age
    body[start + 0xe] = cached.material
  })
  setFloats(At.twoPointHeight, [item.height])
  setFloats(At.stepStartPositionZ, [item.stepStartZ])
  body[At.flags / 4] = item.flags
  item.wheelMaterials.forEach((material, wheelIndex) => {
    const start = (At.wheels + wheelIndex * WHEEL_SIZE) / 4
    body[start + 0xf] = material
    body[start + 0x12] = item.wheelFlags[wheelIndex] ?? 0
    const cacheIndex = item.wheelCacheIndices[wheelIndex] ?? -1
    body[start + 0x11] =
      cacheIndex < 0
        ? 0
        : { buffer: 'body', offset: At.triangleCache + cacheIndex * CACHE_ENTRY_SIZE }
  })
  const display = new Array<EmulatorArgument>(FRAME_WORDS).fill(0)
  display[0] = FRAME_VTABLE
  display[4] = getBitsFromFloat(item.radius)
  return {
    address: PROBE_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'body' }, item.step],
    buffers: [
      { name: 'body', words: body, isRead: true },
      { name: 'display', words: display, isRead: false },
      {
        name: 'track',
        words: Object.assign(getFrameWords([1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0]), {
          [0x58 / 4]: { buffer: 'trackVolume' },
        }),
        isRead: false,
      },
      getVolumeBuffer('trackVolume', item.trackAnswers),
      ...item.objects.flatMap((object, index) => [
        {
          name: `object${String(index)}`,
          words: Object.assign(getFrameWords(object.rotation, object.position), {
            [0x58 / 4]: { buffer: `volume${String(index)}` },
          }),
          isRead: false,
        },
        getVolumeBuffer(`volume${String(index)}`, object.answers),
      ]),
    ],
    patches: [QUERY_STUB],
  }
}

const getAnswerResult = (answer: QueryAnswer): SegmentQueryResult => {
  const [x, y, z] = answer.crossing as [number, number, number]
  const point: Vector3 = { x, y, z }
  if (answer.mode === 0) return { intersection: undefined, lastCrossingPoint: undefined }
  if (answer.mode === 2) return { intersection: undefined, lastCrossingPoint: point }
  const words = answer.triangle
  const vertex = (start: number): Vector3 => ({
    x: words[start] ?? 0,
    y: words[start + 1] ?? 0,
    z: words[start + 2] ?? 0,
  })
  return {
    lastCrossingPoint: point,
    intersection: {
      point,
      materialIndex: answer.material,
      fraction: 0,
      triangle: {
        vertices: [vertex(0), vertex(3), vertex(6)],
        normal: vertex(9),
        planeDistance: words[12] ?? 0,
      },
    },
  }
}

const getToVector = (values: readonly number[]): Vector3 => ({
  x: values[0] ?? 0,
  y: values[1] ?? 0,
  z: values[2] ?? 0,
})

const getPortBody = (item: ProbeCase): CarRigidBody => {
  const blank = getBlankBody()
  const wheels: readonly CarWheel[] = blank.wheels.map((wheel, index) =>
    Object.freeze({
      ...wheel,
      material:
        (item.wheelMaterials[index] ?? 0) === 0
          ? undefined
          : MATERIAL_NAMES[item.wheelMaterials[index] ?? 0],
      isOnGround: ((item.wheelFlags[index] ?? 0) & 1) !== 0,
      isProbed: ((item.wheelFlags[index] ?? 0) & 2) !== 0,
      cachedTriangleIndex: item.wheelCacheIndices[index] ?? -1,
    })
  )
  return Object.freeze({
    ...blank,
    flags: item.flags,
    frame: Object.freeze({
      rotation: Object.freeze([...item.rotation]) as unknown as Matrix3,
      position: getToVector(item.position),
    }),
    linearVelocity: getToVector(item.velocity),
    angularVelocity: getToVector(item.angularVelocity),
    displayBoundingRadius: item.radius,
    twoPointHeight: item.height,
    weight: item.weight,
    groundNormal: getToVector(item.groundNormal),
    localWheelAnchor: getToVector(item.localWheelAnchor),
    trackWidth: item.trackWidth,
    wheelbase: item.wheelbase,
    groundedWheelCount: item.groundedWheelCount,
    wheels: Object.freeze(wheels),
    triangleCache: Object.freeze(
      item.cache.map((cached) =>
        Object.freeze({
          triangle:
            getAnswerResult({
              mode: 1,
              crossing: [0, 0, 0],
              material: cached.material,
              triangle: cached.triangle,
            }).intersection?.triangle ?? blank.triangleCache[0]?.triangle,
          age: cached.age,
          material: MATERIAL_NAMES[cached.material],
        })
      ) as never
    ),
    stepStart: Object.freeze({
      ...blank.stepStart,
      position: Object.freeze({ x: 0, y: 0, z: item.stepStartZ }),
    }),
  })
}

const getObjects = (
  item: ProbeCase
): { readonly objects: readonly CollisionObject[]; readonly query: SegmentQuery } => {
  const answers = new Map<CollisionVolume, readonly QueryAnswer[]>()
  const counters = new Map<CollisionVolume, number>()
  const createObject = (
    rotation: readonly number[],
    position: readonly number[],
    list: readonly QueryAnswer[]
  ): CollisionObject => {
    const volume: CollisionVolume = { nodes: [], vertices: [], triangles: [], materialNames: [] }
    answers.set(volume, list)
    return {
      frame: {
        rotation: Object.freeze([...rotation]) as unknown as Matrix3,
        position: getToVector(position),
      },
      volume,
      materialNames: MATERIAL_NAMES,
    }
  }
  const objects = [
    createObject([1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0], item.trackAnswers),
    ...item.objects.map((object) => createObject(object.rotation, object.position, object.answers)),
  ]
  const query: SegmentQuery = (_arithmetic, volume) => {
    const count = counters.get(volume) ?? 0
    counters.set(volume, count + 1)
    const answer = answers.get(volume)?.[count]
    return answer === undefined
      ? { intersection: undefined, lastCrossingPoint: undefined }
      : getAnswerResult(answer)
  }
  return { objects, query }
}

const getBits = (value: number): number => getBitsFromFloat(value) >>> 0

const getPortBits = (body: CarRigidBody): readonly number[] => {
  const vectorBits = (vector: Vector3): readonly number[] => [
    getBits(vector.x),
    getBits(vector.y),
    getBits(vector.z),
  ]
  return [
    ...body.frame.rotation.map(getBits),
    ...vectorBits(body.frame.position),
    ...vectorBits(body.linearVelocity),
    ...vectorBits(body.groundNormal),
    ...vectorBits(body.slopeForce),
    body.groundedWheelCount,
    ...body.twoPointPositions.flatMap(vectorBits),
    body.flags,
    body.triangleCache.length,
    ...body.triangleCache.flatMap((entry) => [
      ...entry.triangle.vertices.flatMap(vectorBits),
      ...vectorBits(entry.triangle.normal),
      getBits(entry.triangle.planeDistance),
      entry.age,
      entry.material === undefined ? 0 : MATERIAL_NAMES.indexOf(entry.material),
    ]),
    ...body.wheels.flatMap((wheel) => [
      ...vectorBits(wheel.groundForce),
      ...vectorBits(wheel.anchor),
      ...vectorBits(wheel.probeStart),
      ...vectorBits(wheel.probeEnd),
      ...vectorBits(wheel.contactPoint),
      wheel.material === undefined ? 0 : MATERIAL_NAMES.indexOf(wheel.material),
      wheel.cachedTriangleIndex,
      (wheel.isOnGround ? 1 : 0) | (wheel.isProbed ? 2 : 0),
      getBits(wheel.depthSquared),
    ]),
  ]
}

const getOriginalBits = (words: readonly number[]): readonly number[] => {
  const at = (offset: number, count: number): readonly number[] =>
    Array.from({ length: count }, (_, index) => words[offset / 4 + index] ?? 0)
  const cacheCount = words[At.triangleCount / 4] ?? 0
  return [
    ...at(At.frameRotation, 9),
    ...at(At.framePosition, 3),
    ...at(At.linearVelocity, 3),
    ...at(At.groundNormal, 3),
    ...at(At.slopeForce, 3),
    words[At.groundedWheelCount / 4] ?? 0,
    ...at(At.twoPointPositions, 6),
    (words[At.flags / 4] ?? 0) & 0x1ff,
    cacheCount,
    ...Array.from({ length: cacheCount }, (_, index) => {
      const start = At.triangleCache + index * CACHE_ENTRY_SIZE
      return [...at(start, 13), words[(start + 0x34) / 4] ?? 0, words[(start + 0x38) / 4] ?? 0]
    }).flat(),
    ...Array.from({ length: WHEEL_COUNT }, (_, index) => {
      const start = At.wheels + index * WHEEL_SIZE
      const pointer = words[(start + 0x44) / 4] ?? 0
      return [
        ...at(start, 3),
        ...at(start + 0xc, 3),
        ...at(start + 0x18, 3),
        ...at(start + 0x24, 3),
        ...at(start + 0x30, 3),
        words[(start + 0x3c) / 4] ?? 0,
        pointer === 0 ? -1 : (pointer - FIRST_BUFFER_ADDRESS - At.triangleCache) / CACHE_ENTRY_SIZE,
        (words[(start + 0x48) / 4] ?? 0) & 3,
        words[(start + 0x4c) / 4] ?? 0,
      ]
    }).flat(),
  ]
}

const expectProbeMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const arithmetic = createFloatArithmetic(precision)
  const sampler = createFloatSampler(createSeededRandom(PROBE_ADDRESS + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleProbeCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getProbeCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const { objects, query } = getObjects(item)
    const original = getOriginalBits(results[index]?.buffers['body'] ?? [])
    const ported = getPortBits(
      probeTwoPoints(arithmetic, getPortBody(item), item.step, objects, query)
    )
    const differing = original.flatMap((bits, position) =>
      getIsSameFloatBits(bits >>> 0, ported[position] ?? 0) ? [] : [position]
    )
    return differing.length === 0
      ? []
      : [
          `${String(index)}: outputs ${differing.slice(0, 12).join()} of ${String(original.length)} ${JSON.stringify(differing.slice(0, 4).map((position) => [original[position], ported[position]]))} ${JSON.stringify({ radius: item.radius, height: item.height, step: item.step, previous: item.groundedWheelCount, z: item.position[2], start: item.stepStartZ })}`,
        ]
  })

  // Assert
  expect(mismatches.slice(0, 8)).toEqual([])
}

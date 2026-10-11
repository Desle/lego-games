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
import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { getNearestRoute } from './racer-transitions.ts'

const NEAREST_ROUTE_ADDRESS = 0x0043d070
const FRAME_VTABLE = 0x004af700
const FRAME_WORDS = 0x80 / 4
const FRAME_POSITION = 0x4c
const ROUTE_COUNT = 6
const ROUTE_BYTES = 0x48
const ROUTES_POINTER = 0x190
const FRAME_POINTER = 0x5c
// The emulator hands out buffers from here in the order they are listed, so the first one starts at this address.
const FIRST_BUFFER_ADDRESS = 0x20000000
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

type NearestCase = {
  readonly position: Vector3
  readonly routes: readonly (ComputerRacerRoute | null)[]
}

const sampleVector = (sampler: FloatSampler, limit: number): Vector3 => ({
  x: Math.fround(sampler.sampleUniform(limit)),
  y: Math.fround(sampler.sampleUniform(limit)),
  z: Math.fround(sampler.sampleUniform(limit)),
})

const sampleRoute = (sampler: FloatSampler, limit: number): ComputerRacerRoute | null => {
  if (sampler.getIsChance(25)) return null
  const { x, y, z } = sampleVector(sampler, limit)
  return {
    firstVector: [0, 0, 0],
    firstQuaternion: [0, 0, 0, 1],
    secondVector: [x, y, z],
    secondQuaternion: [0, 0, 0, 1],
    firstInteger: 0,
    sampleIndex: 0,
    samples: [{ first: 0, second: 0, bytes: [0, 0, 0, 0, 0, 0, 0, 1] }],
    readByteCount: 0,
  }
}

const sampleNearestCase = (sampler: FloatSampler): NearestCase => {
  const limit = sampler.getIsChance(50) ? 100 : 1e6
  return {
    position: sampleVector(sampler, limit),
    routes: Array.from({ length: ROUTE_COUNT }, () => sampleRoute(sampler, limit)),
  }
}

const getNearestCall = (precision: EmulatorPrecision, item: NearestCase): EmulatorCall => {
  const routeWords = new Array<EmulatorArgument>((ROUTE_COUNT * ROUTE_BYTES) / 4).fill(0)
  item.routes.forEach((route, index) => {
    if (route === null) return
    routeWords[(index * ROUTE_BYTES + 4) / 4] = route.samples.length
    route.secondVector.forEach((value, component) => {
      routeWords[(index * ROUTE_BYTES + 0x24) / 4 + component] = getBitsFromFloat(value)
    })
  })
  const frame = new Array<EmulatorArgument>(FRAME_WORDS).fill(0)
  frame[0] = FRAME_VTABLE
  ;[item.position.x, item.position.y, item.position.z].forEach((value, index) => {
    frame[FRAME_POSITION / 4 + index] = getBitsFromFloat(value)
  })
  const racerSet = new Array<EmulatorArgument>(0x200 / 4).fill(0)
  racerSet[ROUTES_POINTER / 4] = { buffer: 'routes' }
  const racer = new Array<EmulatorArgument>(0x100 / 4).fill(0)
  racer[FRAME_POINTER / 4] = { buffer: 'frame' }
  return {
    address: NEAREST_ROUTE_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'racerSet' }, { buffer: 'racer' }],
    buffers: [
      { name: 'routes', words: routeWords, isRead: false },
      { name: 'frame', words: frame, isRead: false },
      { name: 'racer', words: racer, isRead: false },
      { name: 'racerSet', words: racerSet, isRead: false },
    ],
  }
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const arithmetic = createFloatArithmetic(precision)
  const sampler = createFloatSampler(createSeededRandom(0x43d070 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleNearestCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getNearestCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const address = results[index]?.eax ?? 0
    const originalIndex = address === 0 ? -1 : (address - FIRST_BUFFER_ADDRESS) / ROUTE_BYTES
    const route = getNearestRoute(arithmetic, item.position, item.routes)
    const portIndex = route === null ? -1 : item.routes.indexOf(route)
    return originalIndex === portIndex
      ? []
      : [`${String(index)}: ${String(originalIndex)} against ${String(portIndex)}`]
  })

  // Assert
  expect(mismatches.slice(0, 5)).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('the nearest route against the original', () =>
  it.each(PRECISIONS)(
    '0x0043d070 matches the original in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)

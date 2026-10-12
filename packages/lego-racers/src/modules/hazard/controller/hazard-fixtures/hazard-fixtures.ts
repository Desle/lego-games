import { createSkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { EMPTY_WORLD_ANIMATION } from '../../../world-animation/index.ts'
import type {
  MeshInstanceRuntime,
  SkeletonInstanceRuntime,
  WorldAnimation,
} from '../../../world-animation/index.ts'
import type { EmitterPool } from '../../../emitter/index.ts'
import type {
  HazardEffect,
  HazardRacer,
  HazardSession,
  HazardWorldKey,
} from '../../types/hazard-runtime.types.ts'
import type { Vector3 } from '../../types/hazard.types.ts'
import type { TestSession, TestSessionOptions } from './hazard-fixtures.types.ts'

const FLOAT_MAXIMUM = 3.4028234663852886e38

// An animation of one clip: 11 frames, half a frame per millisecond.
export const TEST_ANIMATION: SkeletalAnimation = Object.freeze({
  positions: [],
  rotations: [],
  times: [],
  tracks: [],
  clips: [
    {
      name: 'a0',
      framesPerMillisecond: 0.5,
      velocity: [0, 0, 0],
      firstTrackIndex: 0,
      frameCount: 300,
      loopLength: 299,
    },
  ],
})

export const createTestSkeletonInstance = (
  name: string,
  overrides: Partial<SkeletonInstanceRuntime> = {}
): SkeletonInstanceRuntime => ({
  name,
  animation: TEST_ANIMATION,
  skeleton: null,
  clip: createSkeletonAnimationState(TEST_ANIMATION, 0),
  isAnimated: true,
  otherFlags: 0,
  position: [1, 2, 3],
  levelSquaredDistances: [FLOAT_MAXIMUM, FLOAT_MAXIMUM, FLOAT_MAXIMUM],
  ...overrides,
})

export const createTestMeshInstance = (name: string): MeshInstanceRuntime => ({
  name,
  position: [0, 0, 0],
  levelSquaredDistances: [100, 200, 300],
  otherFlags: 0,
})

export const createTestWorld = (
  skeletonInstances: readonly SkeletonInstanceRuntime[],
  meshInstances: readonly MeshInstanceRuntime[] = []
): WorldAnimation => ({ ...EMPTY_WORLD_ANIMATION, skeletonInstances, meshInstances })

export const createTestRacer = (index: number, flags = 0): HazardRacer => ({
  index,
  flags,
  position: [10, 20, 30] as Vector3,
})

// A session that records what a hazard does to the bus, the worlds and the random table. `draws` are the table values
// the hazard draws, in order.
export const createTestSession = (options: TestSessionOptions = {}): TestSession => {
  const calls: string[] = []
  const effects: HazardEffect[] = []
  const worlds: Record<HazardWorldKey, WorldAnimation> = {
    track: options.track ?? EMPTY_WORLD_ANIMATION,
    blended: options.blended ?? EMPTY_WORLD_ANIMATION,
  }
  let emitters: EmitterPool | null = options.emitters ?? null
  let drawCount = 0
  const session: HazardSession = {
    arithmetic: createFloatArithmetic(FpuPrecision.SINGLE),
    drawRandomValue: () => {
      const value = options.draws?.[drawCount] ?? 0
      drawCount += 1
      return value
    },
    startSignal: (identifier) => void calls.push(`start ${String(identifier)}`),
    startStopSignal: (start, stop) => void calls.push(`startStop ${String(start)} ${String(stop)}`),
    stopSignal: (identifier) => void calls.push(`stop ${String(identifier)}`),
    getWorld: (key) => worlds[key],
    setWorld: (key, world) => {
      worlds[key] = world
    },
    getEmitters: () => emitters,
    setEmitters: (pool) => {
      emitters = pool
    },
    getRacer: () => null,
    getTableCosine: () => 1,
    probe: options.probe ?? (() => null),
    emit: (effect) => void effects.push(effect),
  }
  return {
    session,
    calls,
    effects,
    getWorld: (key) => worlds[key],
    getDrawCount: () => drawCount,
    getEmitters: () => emitters,
  }
}

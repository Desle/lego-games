import { createSkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { Skeleton } from '../../../skeleton/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { EMPTY_WORLD_ANIMATION, NO_TEXTURE_SCROLL } from '../../../world-animation/index.ts'
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
      boundingSphere: [0, 0, 0, 0],
      firstTrackIndex: 0,
      frameCount: 300,
      loopLength: 299,
    },
  ],
})

// A skeleton of a root at (3, 4, 5), a child of it at (1, 1, 1) and a grandchild at (0, 0, 2).
export const TEST_SKELETON: Skeleton = Object.freeze({
  bones: [
    { name: 'root', position: [3, 4, 5] as const, quaternion: null, parentIndex: null },
    { name: 'child', position: [1, 1, 1] as const, quaternion: null, parentIndex: 0 },
    { name: 'tip', position: [0, 0, 2] as const, quaternion: null, parentIndex: 1 },
    { name: 'end', position: [0, 0, 0] as const, quaternion: null, parentIndex: 2 },
  ],
  readByteCount: 0,
})

export const createTestSkeletonInstance = (
  name: string,
  overrides: Partial<SkeletonInstanceRuntime> = {}
): SkeletonInstanceRuntime => ({
  name,
  animation: TEST_ANIMATION,
  skeleton: null,
  rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  scale: 1,
  boundsRadius: 0,
  clip: createSkeletonAnimationState(TEST_ANIMATION, 0),
  isAnimated: true,
  otherFlags: 0,
  position: [1, 2, 3],
  levelSquaredDistances: [FLOAT_MAXIMUM, FLOAT_MAXIMUM, FLOAT_MAXIMUM],
  textureScroll: NO_TEXTURE_SCROLL,
  ...overrides,
})

export const createTestMeshInstance = (name: string): MeshInstanceRuntime => ({
  name,
  position: [0, 0, 0],
  levelSquaredDistances: [100, 200, 300],
  textureScroll: NO_TEXTURE_SCROLL,
  otherFlags: 0,
})

export const createTestWorld = (
  skeletonInstances: readonly SkeletonInstanceRuntime[],
  meshInstances: readonly MeshInstanceRuntime[] = []
): WorldAnimation => ({ ...EMPTY_WORLD_ANIMATION, skeletonInstances, meshInstances })

export const createTestRacer = (
  index: number,
  flags = 0,
  overrides: Partial<HazardRacer> = {}
): HazardRacer => ({
  index,
  flags,
  position: [10, 20, 30] as Vector3,
  isSpinning: false,
  isColourShifted: false,
  forwardSpeed: 50,
  ...overrides,
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
    getRacer: (index) => options.racers?.[index] ?? null,
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

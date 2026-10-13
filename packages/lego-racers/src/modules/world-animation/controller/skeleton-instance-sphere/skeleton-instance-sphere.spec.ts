import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  createSkeletonAnimationState,
  type SkeletalAnimation,
} from '../../../skeletal-animation/index.ts'
import type { SkeletonInstanceRuntime } from '../../types/world-animation.types.ts'
import { NO_TEXTURE_SCROLL } from '../texture-scroll/texture-scroll.ts'
import { getSkeletonInstanceSphere } from './skeleton-instance-sphere.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const createClip = (name: string, boundingSphere: readonly [number, number, number, number]) => ({
  name,
  framesPerMillisecond: 0.03,
  velocity: [0, 0, 0] as const,
  boundingSphere,
  firstTrackIndex: 0,
  frameCount: 10,
  loopLength: 11,
})
const animation: SkeletalAnimation = Object.freeze({
  positions: [],
  rotations: [],
  times: [],
  tracks: [],
  clips: [createClip('a0', [40, 20, 30, 400]), createClip('a1', [-20, 0, 10, 100])],
})
const instance: SkeletonInstanceRuntime = {
  name: 'beamdumy',
  animation,
  skeleton: null,
  rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  scale: 0.5,
  boundsRadius: 0,
  clip: createSkeletonAnimationState(animation, 0),
  isAnimated: true,
  otherFlags: 0,
  position: [100, 200, 300],
  levelSquaredDistances: [640000],
  textureScroll: NO_TEXTURE_SCROLL,
}

describe('getSkeletonInstanceSphere', () => {
  it('scales the playing clip sphere by the instance scale and carries it by the instance frame (0x10023ef0)', () => {
    // Arrange / Act
    const sphere = getSkeletonInstanceSphere(arithmetic, instance)

    // Assert
    expect(sphere?.centre).toEqual([120, 210, 315])
    expect(sphere?.radius).toBe(200)
  })

  it('has no sphere for an instance that does not animate', () => {
    // Arrange
    const still = { ...instance, isAnimated: false }

    // Act
    const sphere = getSkeletonInstanceSphere(arithmetic, still)

    // Assert
    expect(sphere).toBeNull()
  })

  it('takes the mean centre and the larger radius plus the mean offset while two clips blend', () => {
    // Arrange
    const blending = {
      ...instance,
      clip: {
        ...createSkeletonAnimationState(animation, 0),
        isBlending: true,
        secondClip: createSkeletonAnimationState(animation, 1).clip,
      },
    }

    // Act
    const sphere = getSkeletonInstanceSphere(arithmetic, blending)

    // Assert
    const offset = Math.hypot(10 - -20, 10 - 0, 20 - 10)
    expect(sphere?.centre).toEqual([105, 205, 310])
    expect(sphere?.radius).toBeCloseTo(0.5 * (400 + offset), 3)
  })
})

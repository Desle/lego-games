import { createSkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { SkeletonInstanceRuntime } from '../../types/world-animation.types.ts'
import {
  advanceSkeletonInstance,
  getSkeletonInstanceFlags,
  getSkeletonInstanceTime,
  getSkeletonInstanceWithFlags,
  INSTANCE_ANIMATED_FLAG,
  INSTANCE_FINISHED_FLAG,
  INSTANCE_LOOPING_FLAG,
  startSkeletonInstanceClip,
} from './skeleton-instance.ts'

const animation: SkeletalAnimation = Object.freeze({
  positions: [],
  rotations: [],
  times: [],
  tracks: [],
  clips: [
    {
      name: 'swing',
      framesPerMillisecond: 0.5,
      velocity: [0, 0.25, 0],
      firstTrackIndex: 0,
      frameCount: 11,
      loopLength: 10,
    },
    {
      name: 'rest',
      framesPerMillisecond: 0.25,
      velocity: [0, 0, 0],
      firstTrackIndex: 0,
      frameCount: 5,
      loopLength: 4,
    },
  ],
})

const createInstance = (overrides: Partial<SkeletonInstanceRuntime>): SkeletonInstanceRuntime => ({
  name: 'hammer',
  animation,
  skeleton: null,
  clip: createSkeletonAnimationState(animation, 0),
  isAnimated: true,
  otherFlags: 0,
  position: [1, 2, 3],
  levelSquaredDistances: [3.4028234663852886e38, 3.4028234663852886e38, 3.4028234663852886e38],
  ...overrides,
})

describe('advanceSkeletonInstance', () => {
  it('advances the clip of an animated instance and moves it by the clip velocity', () => {
    // Arrange
    const instance = createInstance({})

    // Act
    const advanced = advanceSkeletonInstance(instance, 8)

    // Assert
    expect(getSkeletonInstanceTime(advanced)).toBe(4)
    expect(advanced.position).toEqual([1, 4, 3])
  })

  it('leaves the clip of an instance without the animated flag alone', () => {
    // Arrange
    const instance = createInstance({ isAnimated: false })

    // Act
    const advanced = advanceSkeletonInstance(instance, 8)

    // Assert
    expect(getSkeletonInstanceTime(advanced)).toBe(0)
  })

  it('wraps a looping clip past its last frame and reports it in the flag word', () => {
    // Arrange
    const instance = advanceSkeletonInstance(createInstance({}), 18)

    // Act
    const wrapped = advanceSkeletonInstance(instance, 6)

    // Assert
    expect(getSkeletonInstanceTime(wrapped)).toBe(2)
    expect(getSkeletonInstanceFlags(wrapped) & 0x2000000).toBe(0x2000000)
    expect(getSkeletonInstanceFlags(advanceSkeletonInstance(wrapped, 2)) & 0x2000000).toBe(0)
  })
})

describe('the flag word', () => {
  it('is the animated bit, the clip state and the other bits together', () => {
    // Arrange
    const instance = createInstance({ otherFlags: 0x2 })

    // Act
    const flags = getSkeletonInstanceFlags(instance)

    // Assert
    expect(flags).toBe(0x2 | INSTANCE_ANIMATED_FLAG | INSTANCE_LOOPING_FLAG)
  })

  it('writes back into the clip state', () => {
    // Arrange
    const instance = createInstance({})

    // Act
    const written = getSkeletonInstanceWithFlags(instance, INSTANCE_FINISHED_FLAG | 0x4)

    // Assert
    expect(written.isAnimated).toBe(false)
    expect(written.otherFlags).toBe(0x4)
    expect(written.clip?.isLooping).toBe(false)
    expect(written.clip?.isFinished).toBe(true)
  })
})

describe('startSkeletonInstanceClip', () => {
  it('restarts the clip at the given frames of time, looping, with the clip velocity', () => {
    // Arrange
    const instance = advanceSkeletonInstance(createInstance({}), 8)

    // Act
    const started = startSkeletonInstanceClip(instance, 1, 4)

    // Assert
    expect(started.clip?.clip).toEqual({
      clipIndex: 1,
      timeInFrames: 1,
      framesPerMillisecond: 0.25,
      velocity: [0, 0, 0],
    })
    expect(started.clip?.isLooping).toBe(true)
    expect(started.isAnimated).toBe(true)
  })

  it('does nothing for a clip the animation does not have', () => {
    // Arrange
    const instance = createInstance({})

    // Act
    const started = startSkeletonInstanceClip(instance, 7, 0)

    // Assert
    expect(started).toBe(instance)
  })
})

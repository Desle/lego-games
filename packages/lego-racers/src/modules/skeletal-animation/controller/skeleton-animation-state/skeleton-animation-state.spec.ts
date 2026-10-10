import type { SkeletalAnimation } from '../../types/skeletal-animation.types.ts'
import { SkeletalAnimationError } from '../../types/skeletal-animation-errors/skeletal-animation-errors.ts'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
} from './skeleton-animation-state.ts'

const animation: SkeletalAnimation = Object.freeze({
  positions: [],
  rotations: [],
  times: [],
  tracks: [],
  clips: [
    {
      name: 'walk',
      framesPerMillisecond: 0.5,
      velocity: [1, 0, 0],
      firstTrackIndex: 0,
      frameCount: 11,
      loopLength: 10,
    },
    {
      name: 'idle',
      framesPerMillisecond: 0.25,
      velocity: [0, 2, 0],
      firstTrackIndex: 1,
      frameCount: 5,
      loopLength: 4,
    },
  ],
})

describe('createSkeletonAnimationState', () => {
  it('starts the clip at time 0, looping, with the clip rate and velocity', () => {
    // Arrange
    // Act
    const state = createSkeletonAnimationState(animation, 1)

    // Assert
    expect(state.clip).toEqual({
      clipIndex: 1,
      timeInFrames: 0,
      framesPerMillisecond: 0.25,
      velocity: [0, 2, 0],
    })
    expect(state.isLooping).toBe(true)
    expect(state.isFinished).toBe(false)
    expect(state.isBlending).toBe(false)
    expect(state.velocity).toEqual([0, 2, 0])
  })

  it('refuses a clip the animation does not have', () => {
    // Arrange
    // Act
    // Assert
    expect(() => createSkeletonAnimationState(animation, 2)).toThrow(SkeletalAnimationError)
  })
})

describe('advanceSkeletonAnimation', () => {
  it('moves the time by the elapsed milliseconds times the rate', () => {
    // Arrange
    const state = createSkeletonAnimationState(animation, 0)

    // Act
    const advanced = advanceSkeletonAnimation(state, animation, 6)

    // Assert
    expect(advanced.clip.timeInFrames).toBe(3)
    expect(advanced.isWrapped).toBe(false)
  })

  it('wraps a looping clip once past its last frame and reports it', () => {
    // Arrange
    const state = advanceSkeletonAnimation(
      createSkeletonAnimationState(animation, 0),
      animation,
      18
    )

    // Act
    const wrapped = advanceSkeletonAnimation(state, animation, 6)

    // Assert
    // 9 frames + 3 = 12 is past frame 10: 12 - 10 = 2.
    expect(wrapped.clip.timeInFrames).toBe(2)
    expect(wrapped.isWrapped).toBe(true)
    expect(advanceSkeletonAnimation(wrapped, animation, 2).isWrapped).toBe(false)
  })

  it('stops a clip that does not loop on its last frame and marks it finished', () => {
    // Arrange
    const state = { ...createSkeletonAnimationState(animation, 0), isLooping: false }

    // Act
    const finished = advanceSkeletonAnimation(state, animation, 100)

    // Assert
    expect(finished.clip.timeInFrames).toBe(10)
    expect(finished.isFinished).toBe(true)
  })

  it('continues with the second clip at the end when the instance is set to', () => {
    // Arrange
    const first = createSkeletonAnimationState(animation, 0)
    const state = {
      ...first,
      isLooping: false,
      isContinuingWithSecondClip: true,
      secondClip: { ...first.clip, clipIndex: 1 },
    }

    // Act
    const continued = advanceSkeletonAnimation(state, animation, 100)

    // Assert
    expect(continued.clip).toEqual({
      clipIndex: 1,
      timeInFrames: 0,
      framesPerMillisecond: 0.25,
      velocity: [0, 2, 0],
    })
    expect(continued.isLooping).toBe(true)
    expect(continued.isFinished).toBe(true)
    expect(continued.velocity).toEqual([0, 2, 0])
  })
})

describe('advanceSkeletonAnimation while blending', () => {
  const first = createSkeletonAnimationState(animation, 0)
  const blending = {
    ...first,
    isBlending: true,
    isFirstAdvancing: true,
    isSecondAdvancing: true,
    secondClip: {
      clipIndex: 1,
      timeInFrames: 0,
      framesPerMillisecond: 0.25,
      velocity: [0, 2, 0] as const,
    },
    blendFactorPerMillisecond: 0.01,
  }

  it('grows the factor, advances both clips (a clip that does not loop stops on its last frame) and mixes the velocity', () => {
    // Arrange
    // Act
    const advanced = advanceSkeletonAnimation(blending, animation, 20)

    // Assert
    expect(advanced.isBlending).toBe(true)
    expect(advanced.blendFactor).toBeCloseTo(0.2, 6)
    expect(advanced.clip.timeInFrames).toBe(10)
    expect(advanced.secondClip.timeInFrames).toBe(4)
    expect(advanced.velocity[0]).toBeCloseTo(0.8, 6)
    expect(advanced.velocity[1]).toBeCloseTo(0.4, 6)
  })

  it('hands over to the second clip when the factor reaches 1 and advances it by the rest of the step', () => {
    // Arrange
    const almost = { ...blending, blendFactor: 0.9, isSecondAdvancing: false }

    // Act
    const done = advanceSkeletonAnimation(almost, animation, 20)

    // Assert
    expect(done.isBlending).toBe(false)
    expect(done.clip.clipIndex).toBe(1)
    expect(done.velocity).toEqual([0, 2, 0])
    // The factor reached 1.1, 10 ms too far: 20 - 10 = 10 ms advance clip 1 by 2.5 frames.
    expect(done.clip.timeInFrames).toBe(2.5)
  })
})

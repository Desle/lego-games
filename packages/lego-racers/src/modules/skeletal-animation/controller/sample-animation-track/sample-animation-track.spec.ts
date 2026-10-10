import type { AnimationTrack, SkeletalAnimation } from '../../types/skeletal-animation.types.ts'
import { getBlendedQuaternion, samplePosition, sampleRotation } from './sample-animation-track.ts'

const animation: SkeletalAnimation = Object.freeze({
  positions: [
    [0, 0, 0],
    [10, 20, 30],
    [20, 0, 0],
  ],
  rotations: [
    [0, 0, 0, 1],
    [0, 0, 1, 0],
  ],
  times: [0, 10, 20, 5],
  tracks: [],
  clips: [],
})

const track: AnimationTrack = Object.freeze({
  rotationStart: 0,
  rotationTimeStart: 3,
  rotationCount: 1,
  positionStart: 0,
  positionTimeStart: 0,
  positionCount: 3,
})

describe('samplePosition', () => {
  it('has nothing to give for a track without keys', () => {
    // Arrange
    const empty = { ...track, positionCount: 0 }

    // Act
    const sample = samplePosition(animation, empty, 3, 30)

    // Assert
    expect(sample).toBeNull()
  })

  it('returns the only key of a one-key track whatever the time', () => {
    // Arrange
    const single = { ...track, positionStart: 1, positionCount: 1 }

    // Act
    const sample = samplePosition(animation, single, 99, 30)

    // Assert
    expect(sample).toEqual([10, 20, 30])
  })

  it('interpolates linearly between the keys around the time', () => {
    // Arrange
    // Act
    const sample = samplePosition(animation, track, 5, 30)

    // Assert
    expect(sample).toEqual([5, 10, 15])
  })

  it('wraps from the last key to the first after the last key time, over the clip length', () => {
    // Arrange
    // Keys at 0, 10 and 20 in a 30 frame clip: the last key to the first spans 10 frames.
    // Act
    const sample = samplePosition(animation, track, 25, 30)

    // Assert
    expect(sample).toEqual([10, 0, 0])
  })

  it('wraps across the clip start for a time before the first key', () => {
    // Arrange
    const shifted = { ...track, positionTimeStart: 3 }
    const shiftedAnimation = { ...animation, times: [0, 0, 0, 5, 15, 25] }

    // Act
    const sample = samplePosition(shiftedAnimation, shifted, 0, 30)

    // Assert
    // Keys at 5, 15, 25 in a 30 frame clip: time 0 is 5 frames after the last key, 10 frames long span.
    expect(sample).toEqual([10, 0, 0])
  })

  it('sits on the last key when the time equals the last key time', () => {
    // Arrange
    const twin = { ...animation, times: [10, 10, 20] }

    // Act
    const sample = samplePosition(twin, { ...track, positionCount: 2 }, 10, 30)

    // Assert
    expect(sample).toEqual([10, 20, 30])
  })
})

describe('getBlendedQuaternion', () => {
  it('moves from the first quaternion to the second by the fraction', () => {
    // Arrange
    // Act
    const blended = getBlendedQuaternion([0, 0, 0, 1], [0, 0, 1, 1], 0.5)

    // Assert
    expect(blended).toEqual([0, 0, 0.5, 1])
  })

  it('goes through the negated second quaternion when the dot product is not positive', () => {
    // Arrange
    // Act
    const blended = getBlendedQuaternion([0, 0, 0, 1], [0, 0, 0, -1], 0.5)

    // Assert
    expect(blended).toEqual([0, 0, 0, 1])
  })
})

describe('sampleRotation', () => {
  it('returns the single quaternion of a one-key track', () => {
    // Arrange
    // Act
    const sample = sampleRotation(animation, track, 7, 30)

    // Assert
    expect(sample).toEqual([0, 0, 0, 1])
  })

  it('blends the two keys around the time without normalising, through the negated one when they are a quarter apart', () => {
    // Arrange
    const twoKeys = { ...track, rotationCount: 2, rotationTimeStart: 0 }

    // Act
    const sample = sampleRotation(animation, twoKeys, 5, 30)

    // Assert
    expect(sample).toEqual([0, 0, -0.5, 0.5])
  })

  it('has nothing to give for a track without rotation keys', () => {
    // Arrange
    const empty = { ...track, rotationCount: 0 }

    // Act
    const sample = sampleRotation(animation, empty, 7, 30)

    // Assert
    expect(sample).toBeNull()
  })
})

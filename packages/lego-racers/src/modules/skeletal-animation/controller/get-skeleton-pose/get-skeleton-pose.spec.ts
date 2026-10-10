import type {
  SkeletalAnimation,
  SkeletalPose,
  SkeletonAnimationState,
} from '../../types/skeletal-animation.types.ts'
import { IDENTITY_BONE_ROTATION } from '../get-bone-rotation/get-bone-rotation.ts'
import { createSkeletonAnimationState } from '../skeleton-animation-state/skeleton-animation-state.ts'
import { getSkeletonPose } from './get-skeleton-pose.ts'

const animation: SkeletalAnimation = Object.freeze({
  positions: [
    [0, 0, 0],
    [10, 0, 0],
    [0, 4, 0],
  ],
  rotations: [[0, 0, 0, 1]],
  times: [0, 10, 0, 10],
  tracks: [
    // Bone 0: two position keys and one rotation key.
    {
      rotationStart: 0,
      rotationTimeStart: 0,
      rotationCount: 1,
      positionStart: 0,
      positionTimeStart: 0,
      positionCount: 2,
    },
    // Bone 1: no keys at all.
    {
      rotationStart: 0,
      rotationTimeStart: 0,
      rotationCount: 0,
      positionStart: 0,
      positionTimeStart: 0,
      positionCount: 0,
    },
    // The second clip's bone 0: one position key.
    {
      rotationStart: 0,
      rotationTimeStart: 0,
      rotationCount: 0,
      positionStart: 2,
      positionTimeStart: 0,
      positionCount: 1,
    },
    {
      rotationStart: 0,
      rotationTimeStart: 0,
      rotationCount: 0,
      positionStart: 0,
      positionTimeStart: 0,
      positionCount: 0,
    },
  ],
  clips: [
    {
      name: 'a',
      framesPerMillisecond: 1,
      velocity: [0, 0, 0],
      firstTrackIndex: 0,
      frameCount: 11,
      loopLength: 10,
    },
    {
      name: 'b',
      framesPerMillisecond: 1,
      velocity: [0, 0, 0],
      firstTrackIndex: 2,
      frameCount: 11,
      loopLength: 10,
    },
  ],
})

const rest: SkeletalPose = Object.freeze({
  bones: [
    { rotation: IDENTITY_BONE_ROTATION, translation: [7, 7, 7] as const },
    { rotation: IDENTITY_BONE_ROTATION, translation: [5, 5, 5] as const },
  ],
})

const getState = (timeInFrames: number): SkeletonAnimationState => {
  const state = createSkeletonAnimationState(animation, 0)
  return { ...state, clip: { ...state.clip, timeInFrames } }
}

describe('getSkeletonPose', () => {
  it('moves a bone to the position sampled from its track and keeps the pose of a bone without keys', () => {
    // Arrange
    const state = getState(5)

    // Act
    const pose = getSkeletonPose(rest, animation, state)

    // Assert
    expect(pose.bones[0]?.translation).toEqual([5, 0, 0])
    expect(pose.bones[0]?.rotation).toEqual(IDENTITY_BONE_ROTATION)
    expect(pose.bones[1]).toEqual(rest.bones[1])
  })

  it('wraps the time of a looping clip before sampling', () => {
    // Arrange
    const state = getState(12.5)

    // Act
    const pose = getSkeletonPose(rest, animation, state)

    // Assert
    expect(pose.bones[0]?.translation).toEqual([2.5, 0, 0])
  })

  it('blends the positions of both clips by the blend factor', () => {
    // Arrange
    const state: SkeletonAnimationState = {
      ...getState(5),
      isBlending: true,
      secondClip: { ...getState(0).clip, clipIndex: 1 },
      blendFactor: 0.25,
    }

    // Act
    const pose = getSkeletonPose(rest, animation, state)

    // Assert
    // From (5, 0, 0) towards (0, 4, 0) by 0.25.
    expect(pose.bones[0]?.translation).toEqual([3.75, 1, 0])
  })

  it('leaves the pose alone for a clip the animation does not have', () => {
    // Arrange
    const state = getState(1)
    const lost: SkeletonAnimationState = { ...state, clip: { ...state.clip, clipIndex: 9 } }

    // Act
    const pose = getSkeletonPose(rest, animation, lost)

    // Assert
    expect(pose).toBe(rest)
  })
})

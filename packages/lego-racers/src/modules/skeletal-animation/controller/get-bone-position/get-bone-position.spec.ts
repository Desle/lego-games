import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { Skeleton } from '../../../skeleton/index.ts'
import type { BoneTransform, SkeletalPose } from '../../types/skeletal-animation.types.ts'
import { getBonePosition } from './get-bone-position.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const

const skeleton: Skeleton = {
  bones: [
    { name: 'root', position: null, quaternion: null, parentIndex: null },
    { name: 'child', position: null, quaternion: null, parentIndex: 0 },
  ],
  readByteCount: 0,
}

const createPose = (transforms: readonly BoneTransform[]): SkeletalPose => ({ bones: transforms })

describe('getBonePosition', () => {
  it('is the translation of a root bone', () => {
    // Arrange
    const pose = createPose([
      { rotation: IDENTITY, translation: [3, 4, 5] },
      { rotation: IDENTITY, translation: [0, 0, 0] },
    ])

    // Act
    const position = getBonePosition(arithmetic, skeleton, pose, 0)

    // Assert
    expect(position).toEqual([3, 4, 5])
  })

  it('carries a child through its parent', () => {
    // Arrange
    const turnedQuarter = [0, 1, 0, -1, 0, 0, 0, 0, 1] as const
    const pose = createPose([
      { rotation: turnedQuarter, translation: [10, 0, 0] },
      { rotation: IDENTITY, translation: [2, 0, 0] },
    ])

    // Act
    const position = getBonePosition(arithmetic, skeleton, pose, 1)

    // Assert
    expect(position).toEqual([10, 2, 0])
  })

  it('has no position for a bone the pose lacks', () => {
    // Arrange
    const pose = createPose([])

    // Act
    const position = getBonePosition(arithmetic, skeleton, pose, 0)

    // Assert
    expect(position).toBeNull()
  })
})

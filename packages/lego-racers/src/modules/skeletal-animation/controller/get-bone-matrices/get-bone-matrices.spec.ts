import type { Skeleton } from '../../../skeleton/index.ts'
import { getBoneMatrices, getRestPose } from './get-bone-matrices.ts'

const getSkeleton = (parentIndices: readonly (number | null)[]): Skeleton => ({
  bones: parentIndices.map((parentIndex, index) => ({
    name: `bone${String(index)}`,
    position: [index + 1, 0, 0] as const,
    quaternion: null,
    parentIndex,
  })),
  readByteCount: 0,
})

describe('getRestPose', () => {
  it('takes each bone position, zero without one, and its quaternion as a rotation', () => {
    // Arrange
    const skeleton: Skeleton = {
      bones: [
        { name: 'a', position: [1, 2, 3], quaternion: [0, 0, 0, 2], parentIndex: null },
        { name: 'b', position: null, quaternion: null, parentIndex: 0 },
      ],
      readByteCount: 0,
    }

    // Act
    const pose = getRestPose(skeleton)

    // Assert
    expect(pose.bones[0]?.translation).toEqual([1, 2, 3])
    expect(pose.bones[0]?.rotation).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
    expect(pose.bones[1]?.translation).toEqual([0, 0, 0])
  })
})

describe('getBoneMatrices', () => {
  it('writes a root bone as its own matrix with the translation in the fourth row', () => {
    // Arrange
    const skeleton = getSkeleton([null])

    // Act
    const matrices = getBoneMatrices(skeleton, getRestPose(skeleton))

    // Assert
    expect([...matrices]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1])
  })

  it('adds the translation of the parent chain to the child', () => {
    // Arrange
    const skeleton = getSkeleton([null, 0, 1])

    // Act
    const matrices = getBoneMatrices(skeleton, getRestPose(skeleton))

    // Assert
    expect([...matrices.subarray(2 * 16 + 12, 2 * 16 + 16)]).toEqual([6, 0, 0, 1])
  })

  it('rotates the child translation by the parent rotation, row vectors on the left', () => {
    // Arrange
    const half = Math.fround(Math.SQRT1_2)
    const skeleton: Skeleton = {
      bones: [
        { name: 'a', position: null, quaternion: [0, 0, half, half], parentIndex: null },
        { name: 'b', position: [1, 0, 0], quaternion: null, parentIndex: 0 },
      ],
      readByteCount: 0,
    }

    // Act
    const matrices = getBoneMatrices(skeleton, getRestPose(skeleton))

    // Assert
    // The parent's row 0 is (0, -1, 0): (1, 0, 0) · M gives its first row.
    expect(matrices[16 + 12]).toBeCloseTo(0, 5)
    expect(matrices[16 + 13]).toBeCloseTo(-1, 5)
  })

  it('uses the identity for a parent that comes after its child', () => {
    // Arrange
    const skeleton = getSkeleton([1, null])

    // Act
    const matrices = getBoneMatrices(skeleton, getRestPose(skeleton))

    // Assert
    expect([...matrices.subarray(12, 16)]).toEqual([1, 0, 0, 1])
  })
})

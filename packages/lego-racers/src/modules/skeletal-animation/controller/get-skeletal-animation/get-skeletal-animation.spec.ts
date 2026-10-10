import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { parseAnimation } from '../../../animation/index.ts'
import type { Animation } from '../../../animation/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseSkeleton } from '../../../skeleton/index.ts'
import { getBoneMatrices, getRestPose } from '../get-bone-matrices/get-bone-matrices.ts'
import { getSkeletonPose } from '../get-skeleton-pose/get-skeleton-pose.ts'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
} from '../skeleton-animation-state/skeleton-animation-state.ts'
import { getSkeletalAnimation } from './get-skeletal-animation.ts'

const animation = Object.freeze({
  keyword28Triples: [[1, 2, 3] as const],
  keyword29Quadruples: [[0, 0, 0, 1] as const],
  keyword2aValues: [-1, 4],
  keyword2bEntries: [[0, 0, -1, 0, 1, 1] as const],
  keyword2cEntries: [
    {
      name: 'walk',
      keyword2fValue: 0.5,
      keyword30Values: [0, 1, 0] as const,
      keyword31Values: [0, 0, 0, 1] as const,
      keyword2bValue: 3,
      keyword2dValue: -2,
      keyword2eValue: 40000,
    },
  ],
  readByteCount: 0,
}) satisfies Animation

describe('getSkeletalAnimation', () => {
  it('names the fields and reads the sixteen-bit counts, times and lengths as unsigned', () => {
    // Arrange
    // Act
    const converted = getSkeletalAnimation(animation)

    // Assert
    expect(converted.times).toEqual([0xffff, 4])
    expect(converted.tracks[0]).toEqual({
      rotationStart: 0,
      rotationTimeStart: 0,
      rotationCount: 0xffff,
      positionStart: 0,
      positionTimeStart: 1,
      positionCount: 1,
    })
    expect(converted.clips[0]).toEqual({
      name: 'walk',
      framesPerMillisecond: 0.5,
      velocity: [0, 1, 0],
      firstTrackIndex: 3,
      frameCount: 0xfffe,
      loopLength: 40000,
    })
  })
})

describe('the original skeletons and animations', () => {
  it.skipIf(!getIsOriginalJamPresent())(
    'keep every parent before its child and pose every skeleton with its animation without a non-finite matrix',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const names = archive
        .getFilePaths()
        .filter((path) => path.endsWith('.SDB'))
        .filter((path) => archive.getFilePaths().includes(path.replace(/\.SDB$/, '.ADB')))

      // Act
      const results = names.map((path) => {
        const skeleton = parseSkeleton(archive.readFile(path))
        const sampled = getSkeletalAnimation(
          parseAnimation(archive.readFile(path.replace(/\.SDB$/, '.ADB')))
        )
        const firstClip = sampled.clips[0]
        if (firstClip === undefined) return { isOrdered: true, isFinite: true }
        const state = advanceSkeletonAnimation(
          createSkeletonAnimationState(sampled, 0),
          sampled,
          123
        )
        const pose = getSkeletonPose(getRestPose(skeleton), sampled, state)
        const matrices = getBoneMatrices(skeleton, pose)
        return {
          isOrdered: skeleton.bones.every(
            (bone, index) => bone.parentIndex === null || bone.parentIndex < index
          ),
          isFinite: matrices.every((value) => Number.isFinite(value)),
        }
      })

      // Assert
      expect(results.length).toBeGreaterThan(100)
      expect(results.filter((result) => !result.isOrdered)).toEqual([])
      expect(results.filter((result) => !result.isFinite)).toEqual([])
    }
  )
})

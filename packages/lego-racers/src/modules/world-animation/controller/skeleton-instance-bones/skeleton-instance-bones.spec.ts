import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { Skeleton } from '../../../skeleton/index.ts'
import type { SkeletonInstanceRuntime } from '../../types/world-animation.types.ts'
import { createSkeletonAnimationState } from '../../../skeletal-animation/index.ts'
import {
  getSkeletonInstanceBoneAxes,
  getSkeletonInstanceBoneTranslation,
  getSkeletonInstanceCameraView,
} from './skeleton-instance-bones.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const animation: SkeletalAnimation = Object.freeze({
  positions: [],
  rotations: [],
  times: [],
  tracks: [],
  clips: [],
})
const skeleton: Skeleton = Object.freeze({
  bones: [
    { name: 'root', position: [3, 4, 5] as const, quaternion: null, parentIndex: null },
    { name: 'camera', position: [1, 1, 1] as const, quaternion: null, parentIndex: 0 },
  ],
  readByteCount: 0,
})
const instance: SkeletonInstanceRuntime = {
  name: 'camDUM',
  animation,
  skeleton,
  rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  scale: 1,
  boundsRadius: 0,
  clip: null,
  isAnimated: true,
  otherFlags: 0,
  position: [10, 20, 30],
  levelSquaredDistances: [],
}

describe('getSkeletonInstanceCameraView', () => {
  it('puts the camera on the bone, carried by the instance, looking along the bone row 0', () => {
    // Arrange
    const boneIndex = 1

    // Act
    const view = getSkeletonInstanceCameraView(arithmetic, instance, boneIndex)

    // Assert
    expect(view?.position).toEqual({ x: 14, y: 25, z: 36 })
    expect(view?.forward).toEqual({ x: 1, y: 0, z: 0 })
    expect(view?.up).toEqual({ x: -0, y: -0, z: -1 })
  })

  it('has no view for a bone the skeleton lacks', () => {
    // Arrange
    const boneIndex = 5

    // Act
    const view = getSkeletonInstanceCameraView(arithmetic, instance, boneIndex)

    // Assert
    expect(view).toBeNull()
  })
})

describe('getSkeletonInstanceBoneTranslation', () => {
  it("carries the bone's own translation by the instance", () => {
    // Arrange
    const boneIndex = 1

    // Act
    const translation = getSkeletonInstanceBoneTranslation(arithmetic, instance, boneIndex)

    // Assert
    expect(translation).toEqual([11, 21, 31])
  })

  it("negates the bone's y in a mirrored race (the emulator's capture hazard, aar2)", () => {
    // Arrange
    const mirrored: SkeletonInstanceRuntime = { ...instance, isMirrored: true }

    // Act
    const translation = getSkeletonInstanceBoneTranslation(arithmetic, mirrored, 1)

    // Assert
    expect(translation).toEqual([11, 19, 31])
  })
})

// One clip whose second bone has one position key and one rotation key.
const keyedAnimation: SkeletalAnimation = Object.freeze({
  positions: [[2, 3, 4] as const],
  rotations: [[0.1, 0.2, 0.3, 0.9273618459701538] as const],
  times: [0],
  tracks: [
    {
      rotationStart: 0,
      rotationTimeStart: 0,
      rotationCount: 0,
      positionStart: 0,
      positionTimeStart: 0,
      positionCount: 0,
    },
    {
      rotationStart: 0,
      rotationTimeStart: 0,
      rotationCount: 1,
      positionStart: 0,
      positionTimeStart: 0,
      positionCount: 1,
    },
  ],
  clips: [
    {
      name: 'a0',
      framesPerMillisecond: 0.5,
      velocity: [0, 0, 0],
      boundingSphere: [0, 0, 0, 0],
      firstTrackIndex: 0,
      frameCount: 10,
      loopLength: 9,
    },
  ],
})

describe('a mirrored world (0x00413310, 0x004015e0)', () => {
  it("mirrors a keyed bone's translation and rotation: y negated, rows turned as M R M (0x0040ea20)", () => {
    // Arrange
    const keyed: SkeletonInstanceRuntime = {
      ...instance,
      animation: keyedAnimation,
      clip: createSkeletonAnimationState(keyedAnimation, 0),
    }
    const mirrored: SkeletonInstanceRuntime = { ...keyed, isMirrored: true }

    // Act
    const axes = getSkeletonInstanceBoneAxes(arithmetic, keyed, 1)
    const mirroredAxes = getSkeletonInstanceBoneAxes(arithmetic, mirrored, 1)
    const translation = getSkeletonInstanceBoneTranslation(arithmetic, mirrored, 1)

    // Assert
    expect(translation).toEqual([12, 17, 34])
    expect(mirroredAxes).toEqual({
      first: { x: axes?.first.x, y: -(axes?.first.y ?? 0), z: axes?.first.z },
      third: { x: axes?.third.x, y: -(axes?.third.y ?? 0), z: axes?.third.z },
    })
  })

  it('mirrors an unkeyed bone through its rest rows (0x10002b20)', () => {
    // Arrange
    const turned: Skeleton = {
      ...skeleton,
      bones: [
        skeleton.bones[0] ?? { name: 'root', position: null, quaternion: null, parentIndex: null },
        { name: 'camera', position: [1, 1, 1], quaternion: [0, 0, 0.6, 0.8], parentIndex: 0 },
      ],
    }
    const mirrored: SkeletonInstanceRuntime = { ...instance, skeleton: turned, isMirrored: true }

    // Act
    const axes = getSkeletonInstanceBoneAxes(arithmetic, { ...mirrored, isMirrored: false }, 1)
    const mirroredAxes = getSkeletonInstanceBoneAxes(arithmetic, mirrored, 1)

    // Assert
    expect(mirroredAxes?.first.x).toBeCloseTo(axes?.first.x ?? 0, 6)
    expect(mirroredAxes?.first.y).toBeCloseTo(-(axes?.first.y ?? 0), 6)
    expect(mirroredAxes?.third.z).toBeCloseTo(axes?.third.z ?? 0, 6)
  })
})

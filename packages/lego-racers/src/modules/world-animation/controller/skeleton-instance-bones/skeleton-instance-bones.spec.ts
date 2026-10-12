import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { Skeleton } from '../../../skeleton/index.ts'
import type { SkeletonInstanceRuntime } from '../../types/world-animation.types.ts'
import { NO_TEXTURE_SCROLL } from '../texture-scroll/texture-scroll.ts'
import { getSkeletonInstanceCameraView } from './skeleton-instance-bones.ts'

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
  textureScroll: NO_TEXTURE_SCROLL,
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

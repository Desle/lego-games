import { getBonePosition, getRestPose, getSkeletonPose } from '../../../skeletal-animation/index.ts'
import type { SkeletalPose, Vector3 } from '../../../skeletal-animation/index.ts'
import { getFrameTransformedPoint } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { SkeletonInstanceRuntime } from '../../types/world-animation.types.ts'

// The pose the instance's bones hold now (GolDP.dll 0x10023580 poses them when the instance advances): the clip's
// sample, or the rest pose without a clip. Null for an instance without a skeleton or an animation.
const getInstancePose = (instance: SkeletonInstanceRuntime): SkeletalPose | null => {
  const { skeleton, animation, clip } = instance
  if (skeleton === null || animation === null) return null
  const rest = getRestPose(skeleton)
  return clip === null ? rest : getSkeletonPose(rest, animation, clip)
}

// The point scaled and carried by the instance's frame (instance vtable +0x2c).
const getPointInInstance = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  local: Vector3,
  scale: number
): Vector3 => {
  const { multiply, storeFloat } = arithmetic
  const [x, y, z] = instance.position
  const moved = getFrameTransformedPoint(
    arithmetic,
    { rotation: instance.rotation, position: { x, y, z } },
    {
      x: storeFloat(multiply(local[0], scale)),
      y: storeFloat(multiply(local[1], scale)),
      z: storeFloat(multiply(local[2], scale)),
    }
  )
  return [moved.x, moved.y, moved.z]
}

// 0x0045ebe0: where a bone's origin is in the world; the origin goes through the bone's transform and each parent's up
// to the root, is scaled and is carried by the instance's frame.
export const getSkeletonInstanceChainPosition = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  boneIndex: number,
  scale: number
): Vector3 | null => {
  const { skeleton } = instance
  const pose = getInstancePose(instance)
  if (skeleton === null || pose === null) return null
  const local = getBonePosition(arithmetic, skeleton, pose, boneIndex)
  return local === null ? null : getPointInInstance(arithmetic, instance, local, scale)
}

// The hazards' reading of a bone (bone slot +0x40 on skeleton slot +0x18): only the bone's own translation, scaled
// by the model's scale times the instance's (0x0048da10, 0x0048cbb0, 0x0048e1c0) and carried by the instance's frame.
export const getSkeletonInstanceBoneTranslation = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  boneIndex: number
): Vector3 | null => {
  const translation = getInstancePose(instance)?.bones[boneIndex]?.translation
  return translation === undefined
    ? null
    : getPointInInstance(arithmetic, instance, translation, instance.scale)
}

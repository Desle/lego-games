import type { Skeleton } from '../../../skeleton/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { SkeletalPose, Vector3 } from '../../types/skeletal-animation.types.ts'

// 0x0045ebe0: where a bone's origin is in the object: the point (0, 0, 0) taken through the bone's transform, then its
// parent's, up to the root (the node's slot +0x4 of the chain).
export const getBonePosition = (
  arithmetic: FloatArithmetic,
  skeleton: Skeleton,
  pose: SkeletalPose,
  boneIndex: number
): Vector3 | null => {
  const { add, multiply, storeFloat } = arithmetic
  const getThrough = (point: Vector3, index: number | null): Vector3 | null => {
    if (index === null) return point
    const transform = pose.bones[index]
    const bone = skeleton.bones[index]
    if (transform === undefined || bone === undefined) return null
    const { rotation, translation } = transform
    const [x, y, z] = point
    const getEntry = (row: number, column: number): number => rotation[row * 3 + column] ?? 0
    const getColumn = (column: 0 | 1 | 2): number =>
      storeFloat(
        add(
          add(
            add(multiply(x, getEntry(0, column)), multiply(y, getEntry(1, column))),
            multiply(z, getEntry(2, column))
          ),
          translation[column]
        )
      )
    return getThrough([getColumn(0), getColumn(1), getColumn(2)], bone.parentIndex)
  }
  return getThrough([0, 0, 0], boneIndex)
}

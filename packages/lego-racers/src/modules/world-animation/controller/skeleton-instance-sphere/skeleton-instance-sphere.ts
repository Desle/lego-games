import type { Vector3 } from '../../../skeletal-animation/index.ts'
import { getFrameTransformedPoint } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type {
  SkeletonInstanceRuntime,
  SkeletonInstanceSphere,
} from '../../types/world-animation.types.ts'

// 0x10056228
const HALF = 0.5

// GolDP.dll 0x10023ef0 (instance slot +0x4c, read through 0x100286d0 by the visibility test 0x100240b0): the sphere an
// animated skeleton instance is culled by. It is the sphere of the clip that plays (clip keyword 0x31), or, while two
// clips blend, the mean of their centres with the larger radius plus the distance of that mean from the second
// centre; scaled by the model's scale times the instance's and carried by the instance's frame. The bones do not move
// it: a model whose bones carry it far from the instance (the alien ship's beam) is culled where the instance stands.
// Null while the instance is not animated (its mesh's own sphere is used then) or has no clip.
export const getSkeletonInstanceSphere = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime
): SkeletonInstanceSphere | null => {
  const { animation, clip, isAnimated } = instance
  if (!isAnimated || animation === null || clip === null) return null
  const first = animation.clips[clip.clip.clipIndex]?.boundingSphere
  if (first === undefined) return null
  const second = clip.isBlending ? animation.clips[clip.secondClip.clipIndex]?.boundingSphere : null
  if (second === undefined) return null
  const { add, multiply, storeFloat } = arithmetic
  const centre: Vector3 =
    second === null
      ? [first[0], first[1], first[2]]
      : [
          storeFloat(multiply(add(second[0], first[0]), HALF)),
          storeFloat(multiply(add(second[1], first[1]), HALF)),
          storeFloat(multiply(add(second[2], first[2]), HALF)),
        ]
  const radius =
    second === null
      ? first[3]
      : Math.max(first[3], second[3]) +
        Math.hypot(centre[0] - second[0], centre[1] - second[1], centre[2] - second[2])
  const [x, y, z] = instance.position
  const moved = getFrameTransformedPoint(
    arithmetic,
    { rotation: instance.rotation, position: { x, y, z } },
    {
      x: storeFloat(multiply(centre[0], instance.scale)),
      y: storeFloat(multiply(centre[1], instance.scale)),
      z: storeFloat(multiply(centre[2], instance.scale)),
    }
  )
  return Object.freeze({
    centre: Object.freeze([moved.x, moved.y, moved.z] as const),
    radius: storeFloat(multiply(instance.scale, radius)),
  })
}

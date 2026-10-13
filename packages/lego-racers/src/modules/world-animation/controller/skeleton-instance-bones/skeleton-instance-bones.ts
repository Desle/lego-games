import { getBonePosition, getRestPose, getSkeletonPose } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation, SkeletalPose, Vector3 } from '../../../skeletal-animation/index.ts'
import type { Skeleton } from '../../../skeleton/index.ts'
import {
  getFrameRotatedVector,
  getFrameTransformedPoint,
  getRotationFromFrameAxes,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, FrameAxes } from '../../../simulation-math/index.ts'
import type {
  SkeletonInstanceCameraView,
  SkeletonInstanceRuntime,
} from '../../types/world-animation.types.ts'

const mirroredRestPoses = new WeakMap<FloatArithmetic, WeakMap<Skeleton, SkeletalPose>>()

// 0x00413310 (from 0x00416140, which Race_LoadTrackContent's world loads 0x00432e20 call in a mirrored race): every bone
// of the world's skeletons has the y of its translation negated (bone slots +0x40, +0x44) and the y of its rotation's
// rows 0 and 2 (slot +0x20), from which slot +0x28 (0x10002b20, Gram-Schmidt as 0x00410900) builds the rotation again.
// The clips' keys are not mirrored: a channel the clip has keys for overrides the mirrored rest.
const getMirroredRestPose = (arithmetic: FloatArithmetic, skeleton: Skeleton): SkeletalPose => {
  const known = mirroredRestPoses.get(arithmetic)?.get(skeleton)
  if (known !== undefined) return known
  const mirrored: SkeletalPose = Object.freeze({
    bones: Object.freeze(
      getRestPose(skeleton).bones.map(({ rotation, translation }) =>
        Object.freeze({
          rotation: getRotationFromFrameAxes(arithmetic, {
            first: { x: rotation[0], y: -rotation[1], z: rotation[2] },
            // @check-allow traced-constants: 6, 7 and 8 are the third row of a 3×3 rotation matrix
            third: { x: rotation[6], y: -rotation[7], z: rotation[8] },
          }),
          translation: Object.freeze([translation[0], -translation[1], translation[2]] as const),
        })
      )
    ),
  })
  const byArithmetic = mirroredRestPoses.get(arithmetic) ?? new WeakMap<Skeleton, SkeletalPose>()
  byArithmetic.set(skeleton, mirrored)
  mirroredRestPoses.set(arithmetic, byArithmetic)
  return mirrored
}

const mirroredAnimations = new WeakMap<SkeletalAnimation, SkeletalAnimation>()

// 0x004015e0 → 0x0040ea20 (the animations of the same mirrored worlds): every position key has its y negated, every
// rotation key its second and fourth words (+0x4, +0xc), which is the same turn mirrored; 0x004015e0 also negates the y
// of each clip's velocity (+0x8) and of its sphere's centre (+0x14).
const getMirroredAnimation = (animation: SkeletalAnimation): SkeletalAnimation => {
  const known = mirroredAnimations.get(animation)
  if (known !== undefined) return known
  const mirrored: SkeletalAnimation = Object.freeze({
    ...animation,
    positions: Object.freeze(
      animation.positions.map((position) =>
        Object.freeze([position[0], -position[1], position[2]] as const)
      )
    ),
    rotations: Object.freeze(
      animation.rotations.map((rotation) =>
        Object.freeze([rotation[0], -rotation[1], rotation[2], -rotation[3]] as const)
      )
    ),
    clips: Object.freeze(
      animation.clips.map((clip) =>
        Object.freeze({
          ...clip,
          velocity: Object.freeze([clip.velocity[0], -clip.velocity[1], clip.velocity[2]] as const),
          boundingSphere: Object.freeze([
            clip.boundingSphere[0],
            -clip.boundingSphere[1],
            clip.boundingSphere[2],
            clip.boundingSphere[3],
          ] as const),
        })
      )
    ),
  })
  mirroredAnimations.set(animation, mirrored)
  return mirrored
}

// The pose the instance's bones hold now (GolDP.dll 0x10023580 poses them when the instance advances): the clip's
// sample, or the rest pose without a clip. Null for an instance without a skeleton or an animation.
const getInstancePose = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime
): SkeletalPose | null => {
  const { skeleton, animation, clip } = instance
  if (skeleton === null || animation === null) return null
  if (instance.isMirrored === true) {
    const mirroredRest = getMirroredRestPose(arithmetic, skeleton)
    return clip === null
      ? mirroredRest
      : getSkeletonPose(mirroredRest, getMirroredAnimation(animation), clip)
  }
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
  const pose = getInstancePose(arithmetic, instance)
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
  const translation = getInstancePose(arithmetic, instance)?.bones[boneIndex]?.translation
  if (translation === undefined) return null
  return getPointInInstance(arithmetic, instance, translation, instance.scale)
}

// A bone's own transform of a point (bone slot +0x4, GolDP.dll 0x10002c10): the point's coordinates times the rows of the
// bone's rotation, plus its translation; every partial sum is stored as a float.
export const getSkeletonInstanceBonePoint = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  boneIndex: number,
  point: Vector3
): Vector3 | null => {
  const { add, multiply, storeFloat } = arithmetic
  const bone = getInstancePose(arithmetic, instance)?.bones[boneIndex]
  if (bone === undefined) return null
  const { rotation, translation } = bone
  const getComponent = (column: number): number => {
    const first = storeFloat(multiply(rotation[column] ?? 0, point[0]))
    // @check-allow traced-constants: 3 is the offset of the second row in a 3×3 rotation matrix
    const second = storeFloat(add(multiply(rotation[column + 3] ?? 0, point[1]), first))
    // @check-allow traced-constants: 6 is the offset of the third row in a 3×3 rotation matrix
    const third = storeFloat(add(multiply(rotation[column + 6] ?? 0, point[2]), second))
    return storeFloat(add(translation[column] ?? 0, third))
  }
  return [getComponent(0), getComponent(1), getComponent(2)]
}

// The bones from the given one up to the root, in the order the hazards' loop walks them (bone slot +0x4, the parent).
const getBoneChain = (skeleton: Skeleton, boneIndex: number): readonly number[] => {
  const parentIndex = skeleton.bones[boneIndex]?.parentIndex ?? null
  return parentIndex === null ? [boneIndex] : [boneIndex, ...getBoneChain(skeleton, parentIndex)]
}

// The rows 0 and 2 of a bone's rotation (bone slot +0x20) turned by the rotation of each bone of `chain` in order
// (bone slot +0xc) and then by the instance's rotation (instance slot +0x34, 0x10026d10).
const getChainTurnedAxes = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  boneIndex: number,
  getChain: (skeleton: Skeleton) => readonly number[]
): FrameAxes | null => {
  const { skeleton } = instance
  const pose = getInstancePose(arithmetic, instance)
  const rotation = pose?.bones[boneIndex]?.rotation
  if (skeleton === null || pose === null || rotation === undefined) return null
  const getRow = (start: number): FrameAxes['first'] =>
    Object.freeze({
      x: rotation[start] ?? 0,
      y: rotation[start + 1] ?? 0,
      z: rotation[start + 2] ?? 0,
    })
  const getTurned = (row: FrameAxes['first']): FrameAxes['first'] =>
    getFrameRotatedVector(
      arithmetic,
      { rotation: instance.rotation, position: ZERO_VECTOR3 },
      getChain(skeleton).reduce((turned, chainIndex) => {
        const chainRotation = pose.bones[chainIndex]?.rotation
        return chainRotation === undefined
          ? turned
          : getFrameRotatedVector(
              arithmetic,
              { rotation: chainRotation, position: ZERO_VECTOR3 },
              turned
            )
      }, row)
    )
  // @check-allow traced-constants: 6 is the offset of the third row in a 3×3 rotation matrix
  return Object.freeze({ first: getTurned(getRow(0)), third: getTurned(getRow(6)) })
}

// 0x004639d0 (the 52 event): rows 0 and 2 of the bone's own rotation (bone slots +0x30 and +0x38), turned only by the
// instance's rotation (instance slot +0x34).
export const getSkeletonInstanceBoneAxes = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  boneIndex: number
): FrameAxes | null => getChainTurnedAxes(arithmetic, instance, boneIndex, () => [])

// 0x0048be70 for a hammer whose name starts with "rk": the bone's own rotation turns its rows first, then each parent's
// up to the root.
export const getSkeletonInstanceChainAxes = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  boneIndex: number
): FrameAxes | null =>
  getChainTurnedAxes(arithmetic, instance, boneIndex, (skeleton) =>
    getBoneChain(skeleton, boneIndex)
  )

// 0x004047b0 (the camera lock, from Camera_Update 0x00428540 and the world update 0x00416090): the locked camera takes
// the bone's origin through its parents (the bone's translation first, then each parent's transform: slot +0x4),
// scaled and carried by the instance's frame (slot +0x2c), as the position; forward is the bone's row 0 and up the
// negated row 2, each turned by the parents' rotations from the bone's parent up (slot +0xc) and the instance's
// (slot +0x34). Hypothesis: the camera node's orientation slot (+0x24) takes (forward, up) in that order.
export const getSkeletonInstanceCameraView = (
  arithmetic: FloatArithmetic,
  instance: SkeletonInstanceRuntime,
  boneIndex: number
): SkeletonInstanceCameraView | null => {
  const position = getSkeletonInstanceChainPosition(arithmetic, instance, boneIndex, instance.scale)
  const axes = getChainTurnedAxes(arithmetic, instance, boneIndex, (skeleton) =>
    getBoneChain(skeleton, boneIndex).slice(1)
  )
  if (position === null || axes === null) return null
  const [x, y, z] = position
  return Object.freeze({
    position: Object.freeze({ x, y, z }),
    forward: axes.first,
    up: Object.freeze({ x: -axes.third.x, y: -axes.third.y, z: -axes.third.z }),
  })
}

import type { Skeleton } from '../../../skeleton/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type {
  BoneMatrices,
  BoneTransform,
  SkeletalPose,
  Vector3,
} from '../../types/skeletal-animation.types.ts'
import { getBoneRotation, IDENTITY_BONE_ROTATION } from '../get-bone-rotation/get-bone-rotation.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, multiply, storeFloat } = arithmetic

const MATRIX_SIZE = 16
const ROW_SIZE = 4
const TRANSLATION_ROW = 3
const ZERO_TRANSLATION: Vector3 = Object.freeze([0, 0, 0] as const)

// The bone's own 4×4 (bone +0x10): the rotation rows with a 0 in the fourth column, then the translation
// row with a 1 (constructor 0x10002890).
const getLocalMatrix = (transform: BoneTransform): Float32Array => {
  const { rotation, translation } = transform
  return new Float32Array([
    ...rotation.slice(0, 3),
    0,
    ...rotation.slice(3, 6),
    0,
    ...rotation.slice(6, 9),
    0,
    ...translation,
    1,
  ])
}

const getIdentityEntry = (row: number, column: number): number => (row === column ? 1 : 0)

// GolDP.dll 0x1002f450: `local × parent` for the first three columns, row vectors; the first three rows sum
// (a·b + c·d) + e·f, the translation row ((a·b + c·d) + parent translation) + e·f, as the x87 code orders them.
const getProduct = (local: Float32Array, parent: Float32Array | null): Float32Array =>
  new Float32Array(
    Array.from({ length: MATRIX_SIZE }, (_unused, entry) => {
      const row = Math.floor(entry / ROW_SIZE)
      const column = entry % ROW_SIZE
      if (column === ROW_SIZE - 1) return row === TRANSLATION_ROW ? 1 : 0
      const getParent = (parentRow: number): number =>
        parent === null
          ? getIdentityEntry(parentRow, column)
          : (parent[parentRow * ROW_SIZE + column] ?? 0)
      const getTerm = (index: number): number =>
        multiply(local[row * ROW_SIZE + index] ?? 0, getParent(index))
      const sum = add(getTerm(0), getTerm(1))
      return storeFloat(
        row === TRANSLATION_ROW
          ? add(add(sum, getParent(TRANSLATION_ROW)), getTerm(2))
          : add(sum, getTerm(2))
      )
    })
  )

// GolDP.dll 0x10014c20 for a skeleton without an alternative transform provider: each bone's matrix is its own
// matrix times its parent's, bones in file order, so a parent stored after its child contributes the identity
// (the original would use the previous frame's value). A root is multiplied by the identity.
export const getBoneMatrices = (skeleton: Skeleton, pose: SkeletalPose): BoneMatrices => {
  const boneMatrices: Float32Array[] = []
  for (const [boneIndex, bone] of skeleton.bones.entries()) {
    const transform = pose.bones[boneIndex]
    const parent = bone.parentIndex === null ? null : (boneMatrices[bone.parentIndex] ?? null)
    boneMatrices.push(
      transform === undefined
        ? new Float32Array(MATRIX_SIZE)
        : getProduct(getLocalMatrix(transform), parent)
    )
  }
  const matrices = new Float32Array(skeleton.bones.length * MATRIX_SIZE)
  for (const [boneIndex, matrix] of boneMatrices.entries()) {
    matrices.set(matrix, boneIndex * MATRIX_SIZE)
  }
  return matrices
}

// The pose a skeleton file describes before any animation: each bone's position (zero when absent) and its
// quaternion as a rotation (the identity when absent).
export const getRestPose = (skeleton: Skeleton): SkeletalPose =>
  Object.freeze({
    bones: Object.freeze(
      skeleton.bones.map((bone) =>
        Object.freeze({
          rotation:
            bone.quaternion === null ? IDENTITY_BONE_ROTATION : getBoneRotation(bone.quaternion),
          translation: bone.position ?? ZERO_TRANSLATION,
        })
      )
    ),
  })

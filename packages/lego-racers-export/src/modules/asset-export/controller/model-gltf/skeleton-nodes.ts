import {
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type {
  AnimationClip,
  BoneMatrices,
  SkeletalAnimation,
  SkeletalPose,
} from '@lego-games/lego-racers/skeletal-animation'
import type { Skeleton } from '@lego-games/lego-racers/skeleton'
import type {
  GltfAnimationChannelSource,
  GltfBuilder,
  GltfQuaternion,
} from '../../services/gltf-builder/gltf-builder.types.ts'
import {
  getInverseMatrix,
  getNearerQuaternion,
  getQuaternionOfRowRotation,
} from '../../services/transform-math/transform-math.ts'
import type { SkeletonNodes } from './skeleton-nodes.types.ts'

const MATRIX_SIZE = 16
const FALLBACK_FRAMES_PER_SECOND = 30
const MILLISECONDS_PER_SECOND = 1000

// The pose a clip, played once from its start, has at a frame.
export const getPoseAtFrame = (
  skeleton: Skeleton,
  animation: SkeletalAnimation,
  clipIndex: number,
  frame: number
): SkeletalPose => {
  const base = createSkeletonAnimationState(animation, clipIndex)
  return getSkeletonPose(getRestPose(skeleton), animation, {
    ...base,
    isLooping: false,
    clip: { ...base.clip, timeInFrames: frame },
  })
}

const getClipPoses = (
  skeleton: Skeleton,
  animation: SkeletalAnimation,
  clipIndex: number,
  clip: AnimationClip
): readonly SkeletalPose[] =>
  Array.from({ length: clip.frameCount }, (_unused, frame) =>
    getPoseAtFrame(skeleton, animation, clipIndex, frame)
  )

const addClipAnimation = (
  builder: GltfBuilder,
  skeleton: Skeleton,
  animation: SkeletalAnimation,
  clipIndex: number,
  jointNodes: readonly number[]
): void => {
  const clip = animation.clips[clipIndex]
  if (clip === undefined || clip.frameCount < 1) return
  const poses = getClipPoses(skeleton, animation, clipIndex, clip)
  const framesPerSecond =
    clip.framesPerMillisecond * MILLISECONDS_PER_SECOND || FALLBACK_FRAMES_PER_SECOND
  const input = builder.addAccessor({
    values: Float32Array.from(poses.keys(), (frame) => frame / framesPerSecond),
    type: 'SCALAR',
    target: 'none',
    isNormalized: false,
    isBounded: true,
  })
  const channels: GltfAnimationChannelSource[] = []
  for (const [boneIndex, node] of jointNodes.entries()) {
    const track = animation.tracks[clip.firstTrackIndex + boneIndex]
    if (track === undefined) continue
    if (track.positionCount > 0) {
      const translations = poses.flatMap((pose) => pose.bones[boneIndex]?.translation ?? [0, 0, 0])
      channels.push({
        node,
        path: 'translation',
        input,
        output: builder.addAccessor({
          values: Float32Array.from(translations),
          type: 'VEC3',
          target: 'none',
          isNormalized: false,
          isBounded: false,
        }),
      })
    }
    if (track.rotationCount > 0) {
      const rotations = poses.reduce<readonly GltfQuaternion[]>((collected, pose) => {
        const quaternion = getQuaternionOfRowRotation(
          pose.bones[boneIndex]?.rotation ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]
        )
        const previous = collected.at(-1)
        return [
          ...collected,
          previous === undefined ? quaternion : getNearerQuaternion(previous, quaternion),
        ]
      }, [])
      channels.push({
        node,
        path: 'rotation',
        input,
        output: builder.addAccessor({
          values: Float32Array.from(rotations.flat()),
          type: 'VEC4',
          target: 'none',
          isNormalized: false,
          isBounded: false,
        }),
      })
    }
  }
  if (channels.length > 0) builder.addAnimation({ name: clip.name, channels })
}

// The bones as glTF nodes in their rest pose, the skin binding them, and one glTF animation per clip.
// `getRestMatrices` gives the matrices the mesh's vertices are baked with.
export const getRestMatrices = (skeleton: Skeleton): BoneMatrices =>
  getBoneMatrices(skeleton, getRestPose(skeleton))

export const addSkeletonNodes = (
  builder: GltfBuilder,
  name: string,
  skeleton: Skeleton,
  animation: SkeletalAnimation | null
): SkeletonNodes => {
  const rest = getRestPose(skeleton)
  const matrices = getRestMatrices(skeleton)
  const firstNode = builder.getNodeCount()
  const childrenByBone = skeleton.bones.map((_bone, boneIndex) =>
    skeleton.bones.flatMap((bone, childIndex) =>
      bone.parentIndex === boneIndex ? [firstNode + childIndex] : []
    )
  )
  const jointNodes = skeleton.bones.map((bone, boneIndex) =>
    builder.addNode({
      name: bone.name,
      translation: rest.bones[boneIndex]?.translation ?? [0, 0, 0],
      rotation: getQuaternionOfRowRotation(
        rest.bones[boneIndex]?.rotation ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]
      ),
      ...((childrenByBone[boneIndex]?.length ?? 0) > 0
        ? { children: childrenByBone[boneIndex] ?? [] }
        : {}),
    })
  )
  const inverseBindMatrices = new Float32Array(skeleton.bones.length * MATRIX_SIZE)
  for (let boneIndex = 0; boneIndex < skeleton.bones.length; boneIndex++) {
    inverseBindMatrices.set(
      getInverseMatrix(matrices.subarray(boneIndex * MATRIX_SIZE, (boneIndex + 1) * MATRIX_SIZE)),
      boneIndex * MATRIX_SIZE
    )
  }
  const skinIndex = builder.addSkin({
    name,
    joints: jointNodes,
    inverseBindMatrices: builder.addAccessor({
      values: inverseBindMatrices,
      type: 'MAT4',
      target: 'none',
      isNormalized: false,
      isBounded: false,
    }),
  })
  for (const clipIndex of animation?.clips.keys() ?? []) {
    if (animation !== null) addClipAnimation(builder, skeleton, animation, clipIndex, jointNodes)
  }
  return Object.freeze({
    rootNodes: jointNodes.filter(
      (_node, boneIndex) => skeleton.bones[boneIndex]?.parentIndex == null
    ),
    skinIndex,
    restMatrices: matrices,
  })
}

import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import type { Scene, SceneInstance } from '@lego-games/lego-racers/scene'
import { getBoneMatrices, getRestPose } from '@lego-games/lego-racers/skeletal-animation'
import type { BoneMatrices } from '@lego-games/lego-racers/skeletal-animation'
import { createGltfBuilder } from '../../services/gltf-builder/gltf-builder.ts'
import type { GltfOutput } from '../../services/gltf-builder/gltf-builder.types.ts'
import { getQuaternionOfRowRotation } from '../../services/transform-math/transform-math.ts'
import type { WorldGltfInput } from './build-model-gltf.types.ts'
import { createMaterialRegistry } from './material-registry.ts'
import { addMeshPrimitives } from './mesh-primitives.ts'
import { getPoseAtFrame } from './skeleton-nodes.ts'
import { Z_UP_TO_Y_UP } from './up-axis.ts'

// The matrices a skeleton instance's mesh is posed with: its starting clip's first frame, else the skeleton's rest.
const getInstanceMatrices = (scene: Scene, instance: SceneInstance): BoneMatrices | null => {
  const level = instance.levels[0]
  const skeleton =
    instance.kind === SceneInstanceKind.SKELETON && level?.skeletonIndex != null
      ? scene.skeletons[level.skeletonIndex]?.skeleton
      : undefined
  if (skeleton === undefined) return null
  const animation =
    level?.animationIndex == null ? undefined : scene.animations[level.animationIndex]?.animation
  const clipIndex = instance.startClipIndex
  const pose =
    animation !== undefined && clipIndex !== null && animation.clips[clipIndex] !== undefined
      ? getPoseAtFrame(skeleton, animation, clipIndex, 0)
      : getRestPose(skeleton)
  return getBoneMatrices(skeleton, pose)
}

// A whole world as one glTF scene: every instance's nearest level placed at the instance's position and rotation.
// Meshes shared by instances are written once; a skeleton instance is posed (its starting clip's first frame).
export const buildWorldGltf = (input: WorldGltfInput): GltfOutput => {
  const { scene } = input
  const builder = createGltfBuilder()
  const registry = createMaterialRegistry(builder, scene, input.getTextureUri)
  const meshByKey = new Map<string, number>()
  const instanceNodes: number[] = []
  for (const instance of scene.instances.filter(
    (candidate) => candidate.worldPath === input.worldPath
  )) {
    const level = instance.levels[0]
    const mesh = level === undefined ? undefined : scene.meshes[level.meshIndex]
    if (level === undefined || mesh === undefined || mesh.drawBatches.length === 0) continue
    const key = [
      level.meshIndex,
      level.materialAssignmentIndex,
      level.skeletonIndex,
      level.animationIndex,
      instance.startClipIndex,
    ].join('/')
    const existing = meshByKey.get(key)
    const meshIndex =
      existing ??
      builder.addMesh(
        mesh.name,
        addMeshPrimitives(builder, registry, mesh, {
          materialIndices:
            (level.materialAssignmentIndex === null
              ? undefined
              : scene.materialAssignments[level.materialAssignmentIndex]?.materialIndices) ??
            mesh.materialIndices,
          matrices: getInstanceMatrices(scene, instance),
          isSkinned: false,
        })
      )
    meshByKey.set(key, meshIndex)
    instanceNodes.push(
      builder.addNode({
        name: instance.name,
        mesh: meshIndex,
        translation: [instance.position.x, instance.position.y, instance.position.z],
        rotation: getQuaternionOfRowRotation(instance.rotation),
      })
    )
  }
  if (instanceNodes.length === 0) throw new Error('The world has no meshes')
  const rootNode = builder.addNode({
    name: 'z_up_to_y_up',
    rotation: Z_UP_TO_Y_UP,
    children: instanceNodes,
  })
  builder.addScene(input.name, [rootNode])
  return builder.build(input.binaryUri)
}

import { createGltfBuilder } from '../../services/gltf-builder/gltf-builder.ts'
import type { GltfOutput } from '../../services/gltf-builder/gltf-builder.types.ts'
import { createMaterialRegistry } from './material-registry.ts'
import { addMeshPrimitives } from './mesh-primitives.ts'
import { addSkeletonNodes } from './skeleton-nodes.ts'
import type { ModelGltfInput } from './build-model-gltf.types.ts'
import { Z_UP_TO_Y_UP } from './up-axis.ts'

// One GDB model as glTF: its triangles in the engine's Z-up frame under a node that turns it to glTF's Y-up and
// applies the model's scale; a model with a skeleton (SDB) is skinned to it and carries its animation clips (ADB).
export const buildModelGltf = (input: ModelGltfInput): GltfOutput => {
  const builder = createGltfBuilder()
  const mesh = input.scene.meshes[input.meshIndex]
  if (mesh === undefined || mesh.drawBatches.length === 0) {
    throw new Error('The model has no triangles')
  }
  const registry = createMaterialRegistry(builder, input.scene, input.getTextureUri)
  const skeletonNodes =
    input.skeleton === null
      ? null
      : addSkeletonNodes(builder, input.name, input.skeleton, input.animation)
  const primitives = addMeshPrimitives(builder, registry, mesh, {
    materialIndices: mesh.materialIndices,
    matrices: skeletonNodes?.restMatrices ?? null,
    isSkinned: skeletonNodes !== null,
  })
  const meshNode = builder.addNode({
    name: input.name,
    mesh: builder.addMesh(input.name, primitives),
    ...(skeletonNodes === null ? {} : { skin: skeletonNodes.skinIndex }),
  })
  const modelNode = builder.addNode({
    name: 'model',
    scale: [input.scale, input.scale, input.scale],
    children: [...(skeletonNodes?.rootNodes ?? []), meshNode],
  })
  const rootNode = builder.addNode({
    name: 'z_up_to_y_up',
    rotation: Z_UP_TO_Y_UP,
    children: [modelNode],
  })
  builder.addScene(input.name, [rootNode])
  return builder.build(input.binaryUri)
}

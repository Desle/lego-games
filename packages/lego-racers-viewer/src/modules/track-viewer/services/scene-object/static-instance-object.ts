import type { SceneInstance } from '@lego-games/lego-racers/scene'
import {
  createBatchMesh,
  createInstanceGroup,
  getBatchMaterial,
  getSharedBatchGeometry,
} from './instance-batches.ts'
import type { InstanceLevelMesh, InstanceObject, SceneObjectContext } from './scene-object.types.ts'

// A mesh or BSP tree instance: one mesh per draw batch of its nearest level, sharing geometry and materials
// with every other instance of the same model.
export const createStaticInstanceObject = (
  context: SceneObjectContext,
  instance: SceneInstance,
  levelMesh: InstanceLevelMesh
): InstanceObject => {
  const group = createInstanceGroup(instance, context.isBackground)
  for (const [batchIndex, batch] of levelMesh.mesh.drawBatches.entries()) {
    const batchMaterial = getBatchMaterial(context, levelMesh, batch)
    if (batchMaterial === null) continue
    const geometry = getSharedBatchGeometry(context, levelMesh, batchIndex, batch, batchMaterial)
    group.add(createBatchMesh(context, geometry, batchMaterial.material))
  }
  return Object.freeze({ group, animate: null, setState: null })
}

import type { SceneDrawBatch, SceneInstance } from '@lego-games/lego-racers/scene'
import { Group, Matrix4, Mesh } from 'three'
import type { BufferGeometry, Material } from 'three'
import { createBatchGeometry } from './batch-geometry.ts'
import { createSceneMaterial } from './scene-material.ts'
import type { BatchMaterial, InstanceLevelMesh, SceneObjectContext } from './scene-object.types.ts'

// Rows of the instance rotation are the images of the model's x, y and z axes (GolDP.dll 0x10026b50 and the
// row-vector transform of 0x1000c630); three.js takes them as columns. A background instance keeps its
// rotation only: the sky sets every instance of the background world to one position (LEGORacers.exe 0x0041d040).
export const getInstanceMatrix = (instance: SceneInstance, isBackground: boolean): Matrix4 => {
  const [forwardX, forwardY, forwardZ, sideX, sideY, sideZ, upX, upY, upZ] = instance.rotation
  const { x, y, z } = isBackground ? { x: 0, y: 0, z: 0 } : instance.position
  return new Matrix4().set(
    forwardX,
    sideX,
    upX,
    x,
    forwardY,
    sideY,
    upY,
    y,
    forwardZ,
    sideZ,
    upZ,
    z,
    0,
    0,
    0,
    1
  )
}

// The material of a batch: the instance level's material assignment replaces the model's materials when it
// has one (0x10006c50). The background is drawn without the depth test or depth writes (the renderer slot
// +0xe8 turns the depth buffer off while the sky is drawn).
export const getBatchMaterial = (
  context: SceneObjectContext,
  levelMesh: InstanceLevelMesh,
  batch: SceneDrawBatch
): BatchMaterial | null => {
  const { scene } = context
  const { level, mesh } = levelMesh
  const assignment =
    level.materialAssignmentIndex === null
      ? null
      : scene.materialAssignments[level.materialAssignmentIndex]
  const materialIndex = (assignment?.materialIndices ?? mesh.materialIndices)[batch.materialSlot]
  const sceneMaterial = materialIndex === undefined ? undefined : scene.materials[materialIndex]
  if (materialIndex === undefined || sceneMaterial === undefined) return null
  const materialKey = `${String(materialIndex)}/${String(mesh.colors === null)}`
  const material =
    context.materials.get(materialKey) ??
    createSceneMaterial(sceneMaterial, scene.textures, context.textureCache)
  if (context.isBackground) {
    material.depthTest = false
    material.depthWrite = false
  }
  context.materials.set(materialKey, material)
  return { material, materialIndex, sceneMaterial }
}

// One shared geometry per mesh batch and material, for instances that never change shape.
export const getSharedBatchGeometry = (
  context: SceneObjectContext,
  levelMesh: InstanceLevelMesh,
  batchIndex: number,
  batch: SceneDrawBatch,
  batchMaterial: BatchMaterial
): BufferGeometry => {
  const key = `${String(levelMesh.level.meshIndex)}/${String(batchIndex)}/${String(batchMaterial.materialIndex)}`
  const geometry =
    context.geometries.get(key) ??
    createBatchGeometry(
      levelMesh.mesh,
      batch,
      batchMaterial.sceneMaterial.renderState,
      batchMaterial.sceneMaterial.ambientColor
    )
  context.geometries.set(key, geometry)
  return geometry
}

// The batch's mesh object: drawn in submission order in the background.
export const createBatchMesh = (
  context: SceneObjectContext,
  geometry: BufferGeometry,
  material: Material
): Mesh => {
  const mesh = new Mesh(geometry, material)
  if (context.isBackground) mesh.renderOrder = context.nextDrawOrder()
  return mesh
}

export const createInstanceGroup = (instance: SceneInstance, isBackground: boolean): Group => {
  const group = new Group()
  group.name = instance.name
  group.matrixAutoUpdate = false
  group.matrix.copy(getInstanceMatrix(instance, isBackground))
  return group
}

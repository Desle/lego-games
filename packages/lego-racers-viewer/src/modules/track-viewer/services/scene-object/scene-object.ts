import type { Scene, SceneInstance } from '@lego-games/lego-racers/scene'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Matrix4,
  Mesh,
  type BufferGeometry,
  type Material,
} from 'three'
import { createBatchGeometry } from './batch-geometry.ts'
import { createSceneMaterial } from './scene-material.ts'
import type { SceneObject, TextureCache } from './scene-object.types.ts'

// Rows of the instance rotation are the images of the model's x, y and z axes (GolDP.dll 0x10026b50 and the
// row-vector transform of 0x1000c630); three.js takes them as columns.
const getInstanceMatrix = (instance: SceneInstance): Matrix4 => {
  const [forwardX, forwardY, forwardZ, sideX, sideY, sideZ, upX, upY, upZ] = instance.rotation
  const { x, y, z } = instance.position
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

const createLights = (scene: Scene): readonly (AmbientLight | DirectionalLight)[] => [
  ...scene.ambientLights.map(
    ({ color: [red, green, blue] }) =>
      new AmbientLight(new Color(red / 255, green / 255, blue / 255))
  ),
  ...scene.directionalLights.map(({ color: [red, green, blue], direction }) => {
    const light = new DirectionalLight(new Color(red / 255, green / 255, blue / 255))
    light.position.set(-direction.x, -direction.y, -direction.z)
    return light
  }),
]

// Builds the three.js objects for a scene: one mesh per draw batch of each instance's nearest level, using
// that level's material assignment in place of the model's materials when it has one (0x10006c50).
export const createSceneObject = (scene: Scene): SceneObject => {
  const group = new Group()
  const textureCache: TextureCache = new Map()
  const materials = new Map<string, Material>()
  const geometries = new Map<string, BufferGeometry>()
  for (const instance of scene.instances) {
    const level = instance.levels[0]
    const mesh = level === undefined ? undefined : scene.meshes[level.meshIndex]
    if (level === undefined || mesh === undefined) continue
    const assignment =
      level.materialAssignmentIndex === null
        ? null
        : scene.materialAssignments[level.materialAssignmentIndex]
    const materialIndices = assignment?.materialIndices ?? mesh.materialIndices
    const instanceGroup = new Group()
    instanceGroup.name = instance.name
    instanceGroup.matrixAutoUpdate = false
    instanceGroup.matrix.copy(getInstanceMatrix(instance))
    for (const [batchIndex, batch] of mesh.drawBatches.entries()) {
      const materialIndex = materialIndices[batch.materialSlot]
      const sceneMaterial = materialIndex === undefined ? undefined : scene.materials[materialIndex]
      if (materialIndex === undefined || sceneMaterial === undefined) continue
      const materialKey = `${String(materialIndex)}/${String(mesh.colors === null)}`
      const material =
        materials.get(materialKey) ??
        createSceneMaterial(sceneMaterial, mesh, scene.textures, textureCache)
      materials.set(materialKey, material)
      const geometryKey = `${String(level.meshIndex)}/${String(batchIndex)}/${String(materialIndex)}`
      const geometry =
        geometries.get(geometryKey) ?? createBatchGeometry(mesh, batch, sceneMaterial.renderState)
      geometries.set(geometryKey, geometry)
      instanceGroup.add(new Mesh(geometry, material))
    }
    group.add(instanceGroup)
  }
  group.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(group)
  for (const light of createLights(scene)) group.add(light)
  const dispose = () => {
    for (const geometry of geometries.values()) geometry.dispose()
    for (const material of materials.values()) material.dispose()
    for (const texture of textureCache.values()) texture.dispose()
  }
  return Object.freeze({ group, bounds, dispose })
}

import type { Scene, SceneInstance } from '@lego-games/lego-racers/scene'
import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import { AmbientLight, Box3, Color, DirectionalLight, Group } from 'three'
import type { BufferGeometry, Material } from 'three'
import { createSkeletonInstanceObject } from './skeleton-instance-object.ts'
import { createStaticInstanceObject } from './static-instance-object.ts'
import type {
  InstanceLevelMesh,
  InstanceObject,
  SceneObject,
  SceneObjectContext,
  SceneObjectOptions,
} from './scene-object.types.ts'

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

// The nearest level of an instance and its mesh; a skeleton instance without a mesh (a camera's skeleton) has none.
const getInstanceLevelMesh = (scene: Scene, instance: SceneInstance): InstanceLevelMesh | null => {
  const level = instance.levels[0]
  const mesh = level === undefined ? undefined : scene.meshes[level.meshIndex]
  return level === undefined || mesh === undefined
    ? null
    : { level, mesh, meshIndex: level.meshIndex }
}

const createInstanceObject = (
  context: SceneObjectContext,
  instance: SceneInstance,
  levelMesh: InstanceLevelMesh
): InstanceObject | null =>
  instance.kind === SceneInstanceKind.SKELETON
    ? createSkeletonInstanceObject(context, instance, levelMesh)
    : createStaticInstanceObject(context, instance, levelMesh)

// Builds the three.js objects for a scene: one mesh per draw batch of each instance's nearest level, using
// that level's material assignment in place of the model's materials when it has one (0x10006c50). Skeleton
// instances follow the bone matrices of their animation.
export const createSceneObject = (scene: Scene, options: SceneObjectOptions): SceneObject => {
  let drawOrder = 0
  const context: SceneObjectContext = {
    scene,
    isBackground: options.isBackground,
    textureCache: new Map(),
    materials: new Map<string, Material>(),
    geometries: new Map<string, BufferGeometry>(),
    nextDrawOrder: () => {
      drawOrder += 1
      return drawOrder
    },
  }
  const group = new Group()
  const animators: ((deltaMilliseconds: number) => void)[] = []
  for (const instance of scene.instances.filter(options.includeInstance)) {
    const levelMesh = getInstanceLevelMesh(scene, instance)
    const instanceObject =
      levelMesh === null ? null : createInstanceObject(context, instance, levelMesh)
    if (instanceObject === null) continue
    group.add(instanceObject.group)
    if (instanceObject.animate !== null) animators.push(instanceObject.animate)
  }
  group.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(group)
  for (const light of createLights(scene)) group.add(light)
  const dispose = () => {
    for (const geometry of context.geometries.values()) geometry.dispose()
    for (const material of context.materials.values()) material.dispose()
    for (const texture of context.textureCache.values()) texture.dispose()
    group.traverse((object) => {
      if ('geometry' in object) (object.geometry as BufferGeometry).dispose()
    })
  }
  return Object.freeze({
    group,
    bounds,
    animate: (deltaMilliseconds: number) => {
      for (const animator of animators) animator(deltaMilliseconds)
    },
    animatedInstanceCount: animators.length,
    dispose,
  })
}

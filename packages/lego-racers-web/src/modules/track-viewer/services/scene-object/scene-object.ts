import type { Scene, SceneInstance } from '@lego-games/lego-racers/scene'
import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import { Box3, Group, Mesh, Vector3 } from 'three'
import type { BufferGeometry, Material, Matrix4 } from 'three'
import { applyColourShift, getMeshGeometries } from './colour-shift.ts'
import type {
  ColourShiftLike,
  FrustumView,
  Vector3Like,
} from '../race-viewport/race-viewport.types.ts'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { getLocalVisibilityQuery, showVisibleLeaves } from './bsp-visibility.ts'
import {
  createTextureScroll,
  getAdvancedTextureScroll,
  getTextureScrollOffsets,
} from '@lego-games/lego-racers/world-animation'
import { setTextureOffset } from './texture-offset.ts'
import { getInstanceMatrix, setSlotMaterial } from './instance-batches.ts'
import { applyVertexLighting } from './vertex-lighting.ts'
import type { SceneLights } from './vertex-lighting.types.ts'
import { createSkeletonInstanceObject } from './skeleton-instance-object.ts'
import { createStaticInstanceObject } from './static-instance-object.ts'
import { getIsSphereInFrustum } from './sphere-visibility.ts'
import type {
  InstanceLevelMesh,
  InstanceObject,
  InstanceRuntime,
  SceneObject,
  SceneObjectContext,
  SceneObjectOptions,
} from './scene-object.types.ts'

// The mesh of one level of an instance; a skeleton instance without a mesh (a camera's skeleton) has none.
const getInstanceLevelMesh = (
  scene: Scene,
  instance: SceneInstance,
  levelIndex: number
): InstanceLevelMesh | null => {
  const level = instance.levels[levelIndex]
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

// FUN_10027cc0: the level an instance draws at a camera position is the first whose squared distance the squared
// distance to the camera does not exceed; past the last level the instance is not drawn (null).
export const getLevelIndex = (
  squaredDistances: readonly number[],
  squaredCameraDistance: number
): number | null => {
  const index = squaredDistances.findIndex((distance) => squaredCameraDistance <= distance)
  return index === -1 ? null : index
}

// Builds the three.js objects for a scene: one mesh per draw batch of each level of each instance, using that
// level's material assignment in place of the model's materials when it has one (0x10006c50), and only the level
// the camera's distance selects is shown. Skeleton instances follow the bone matrices of their animation.
export const createSceneObject = (scene: Scene, options: SceneObjectOptions): SceneObject => {
  let drawOrder = 0
  const context: SceneObjectContext = {
    scene,
    isBackground: options.isBackground,
    textureCache: new Map(),
    materials: new Map<string, Material>(),
    geometries: new Map<string, BufferGeometry>(),
    slotMeshes: new Map(),
    nextDrawOrder: () => {
      drawOrder += 1
      return drawOrder
    },
  }
  const group = new Group()
  const animators: ((deltaMilliseconds: number) => void)[] = []
  const stateSetters = new Map<string, NonNullable<InstanceObject['setState']>>()
  const levelSelectors: ((camera: Vector3Like, view: FrustumView | undefined) => void)[] = []
  const runtimes = new Map<string, InstanceRuntime>()
  const scrollers: ((deltaMilliseconds: number) => void)[] = []
  const leafSelectors: ((view: FrustumView, worldToLocal: Matrix4) => void)[] = []
  const instancesByName = new Map<string, SceneInstance>()
  for (const instance of scene.instances.filter(options.includeInstance)) {
    if (!instancesByName.has(instance.name)) instancesByName.set(instance.name, instance)
    const levelObjects = instance.levels.flatMap((_level, levelIndex) => {
      const levelMesh = getInstanceLevelMesh(scene, instance, levelIndex)
      const instanceObject =
        levelMesh === null ? null : createInstanceObject(context, instance, levelMesh)
      return instanceObject === null ? [] : [{ levelIndex, instanceObject }]
    })
    for (const { levelIndex, instanceObject } of levelObjects) {
      // Level 0 is shown until a camera says otherwise.
      instanceObject.group.visible = levelIndex === 0
      group.add(instanceObject.group)
      if (instanceObject.animate !== null) animators.push(instanceObject.animate)
    }
    // The background's world is not part of the simulation: Sky_Update (0x00416090) scrolls its instances here.
    if (options.isBackground && instance.textureScrollPerSecond !== null) {
      let scroll = createTextureScroll(instance.textureScrollPerSecond)
      scrollers.push((deltaMilliseconds) => {
        scroll = getAdvancedTextureScroll(scroll, deltaMilliseconds)
        const [offsetU, offsetV] = getTextureScrollOffsets(scroll)
        for (const { instanceObject } of levelObjects)
          setTextureOffset(instanceObject.group, offsetU, offsetV)
      })
    }
    const setters = levelObjects.flatMap(({ instanceObject }) =>
      instanceObject.setState === null ? [] : [instanceObject.setState]
    )
    if (setters.length > 0) {
      stateSetters.set(instance.name, (state) => {
        for (const setState of setters) setState(state)
      })
    }
    const bspLevels = levelObjects.flatMap(({ levelIndex, instanceObject }) => {
      const tree = scene.bspTrees[instance.levels[levelIndex]?.bspTreeIndex ?? -1]
      const meshes = instanceObject.group.children.filter(
        (child): child is Mesh => child instanceof Mesh
      )
      return tree === undefined ? [] : [{ tree: tree.tree, meshes }]
    })
    const bspTree = bspLevels[0]?.tree
    if (bspTree !== undefined) {
      leafSelectors.push((view, worldToLocal) =>
        showVisibleLeaves(bspTree, bspLevels, getLocalVisibilityQuery(view, worldToLocal))
      )
    }
    if (levelObjects.length > 0 && !options.isBackground) {
      const fileDistances = instance.levels.map((level) => level.squaredDistance)
      const instanceMatrix = getInstanceMatrix(instance, false)
      const localPosition = new Vector3().setFromMatrixPosition(instanceMatrix)
      // GolDP.dll 0x10027ea0: the sphere of the instance's first level mesh, carried by the instance's frame.
      const meshSphere = scene.meshes[instance.levels[0]?.meshIndex ?? -1]?.boundingSphere ?? null
      const localSphereCentre =
        meshSphere === null
          ? null
          : new Vector3(meshSphere.centre.x, meshSphere.centre.y, meshSphere.centre.z).applyMatrix4(
              instanceMatrix
            )
      levelSelectors.push((camera, view) => {
        const runtime = runtimes.get(instance.name)
        const distances = runtime?.levelSquaredDistances ?? fileDistances
        const sphere =
          runtime?.sphere ??
          (meshSphere === null || localSphereCentre === null
            ? null
            : {
                centre: localSphereCentre.clone().applyMatrix4(group.matrixWorld),
                radius: meshSphere.radius,
              })
        const position = runtime?.position ?? localPosition.clone().applyMatrix4(group.matrixWorld)
        // 0x100240b0 measures a skeleton instance from its sphere's centre, 0x10027d80 a mesh instance from its position.
        const centre =
          instance.kind === SceneInstanceKind.SKELETON ? (sphere?.centre ?? position) : position
        const squaredDistance =
          (camera.x - centre.x) ** 2 + (camera.y - centre.y) ** 2 + (camera.z - centre.z) ** 2
        const distanceLevel = getLevelIndex(distances, squaredDistance)
        const selected =
          distanceLevel !== null &&
          sphere !== null &&
          view !== undefined &&
          !getIsSphereInFrustum(view, sphere.centre, sphere.radius)
            ? null
            : distanceLevel
        for (const { levelIndex, instanceObject } of levelObjects) {
          instanceObject.group.visible = levelIndex === selected
        }
      })
    }
  }
  group.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(group)
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
      for (const scroller of scrollers) scroller(deltaMilliseconds)
    },
    setInstanceColourShift: (name: string, shift: ColourShiftLike | null) => {
      for (const child of group.children) {
        if (child.name.toLowerCase() !== name.toLowerCase()) continue
        for (const geometry of getMeshGeometries(child)) applyColourShift(geometry, shift)
      }
    },
    setInstanceTextureOffset: (name: string, offsetU: number, offsetV: number) => {
      for (const child of group.children) {
        if (child.name.toLowerCase() === name.toLowerCase())
          setTextureOffset(child, offsetU, offsetV)
      }
    },
    setColourShift: (shift: ColourShiftLike | null) => {
      for (const geometry of getMeshGeometries(group)) applyColourShift(geometry, shift)
    },
    selectLevels: (camera: Vector3Like, view?: FrustumView) => {
      group.updateWorldMatrix(true, false)
      for (const select of levelSelectors) select(camera, view)
    },
    setInstanceRuntime: (name: string, runtime: InstanceRuntime) => runtimes.set(name, runtime),
    selectVisibleLeaves: (view: FrustumView) => {
      if (leafSelectors.length === 0) return
      group.updateWorldMatrix(true, false)
      const worldToLocal = group.matrixWorld.clone().invert()
      for (const select of leafSelectors) select(view, worldToLocal)
    },
    setSkeletonState: (name: string, state: SkeletonAnimationState) =>
      stateSetters.get(name)?.(state),
    animatedInstanceCount: animators.length,
    setMaterialSlot: (instanceName, levelIndex, slot, materialName) => {
      const level = instancesByName.get(instanceName)?.levels[levelIndex]
      const materialIndex = scene.materials.findLastIndex(
        (material) => material.name === materialName
      )
      if (level === undefined || materialIndex === -1) return false
      setSlotMaterial(context, level, slot, materialIndex)
      return true
    },
    setLights: (lights: SceneLights | null) => applyVertexLighting(group, lights),
    setAnimationState: (state: SkeletonAnimationState) => {
      for (const setState of stateSetters.values()) setState(state)
    },
    dispose,
  })
}

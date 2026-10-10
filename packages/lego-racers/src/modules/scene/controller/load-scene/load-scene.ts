import type { JamArchive } from '../../../jam-archive/index.ts'
import { readWorld } from '../../../world/index.ts'
import type { AmbientLight, Camera, DirectionalLight } from '../../../world/index.ts'
import { getDirectory } from '../../types/scene-path/scene-path.ts'
import type {
  Scene,
  SceneAmbientLight,
  SceneCamera,
  SceneDirectionalLight,
} from '../../types/scene.types.ts'
import { linkBspTreeInstances, linkMeshInstances, linkSkeletonInstances } from './link-instances.ts'
import { linkMaterials } from './link-materials.ts'
import { linkMaterialAssignments, linkMeshes } from './link-meshes.ts'
import { linkAnimations, linkSkeletons } from './link-skeletons.ts'
import { linkTextures } from './link-textures.ts'

const getRgb = (colorBytes: readonly number[]): readonly [number, number, number] =>
  Object.freeze([colorBytes[0] ?? 0, colorBytes[1] ?? 0, colorBytes[2] ?? 0])

// The world stores the camera's second axis negated (0x1002dc80); the up vector is its negation.
const getSceneCamera = (camera: Camera): SceneCamera =>
  Object.freeze({
    name: camera.name,
    position: camera.position,
    forward: camera.forward,
    up: Object.freeze({ x: -camera.negatedUp.x, y: -camera.negatedUp.y, z: -camera.negatedUp.z }),
  })

const getSceneAmbientLight = (light: AmbientLight): SceneAmbientLight =>
  Object.freeze({ color: getRgb(light.colorBytes) })

const getSceneDirectionalLight = (light: DirectionalLight): SceneDirectionalLight =>
  Object.freeze({ color: getRgb(light.colorBytes), direction: light.direction })

const EMPTY_SCENE: Scene = Object.freeze({
  worldPaths: [],
  textures: [],
  materials: [],
  meshes: [],
  materialAssignments: [],
  skeletons: [],
  animations: [],
  instances: [],
  cameras: [],
  ambientLights: [],
  directionalLights: [],
})

// Loads one world on top of the worlds loaded before it, the way GolDP.dll does: the WDB (0x1002c240), then
// every file its name lists name (0x10017ac0: textures, materials, meshes, material assignments), then its
// instances are linked (0x1002e640). Its files are opened relative to its own directory, which the game makes
// the archive's current directory before loading it (LEGORacers.exe 0x0044c810 into archive +0x1c, read by
// 0x10031c90).
const getSceneWithWorld = (archive: JamArchive, scene: Scene, worldPath: string): Scene => {
  const source = Object.freeze({ archive, directory: getDirectory(worldPath) })
  const world = readWorld(archive.readFile(worldPath))
  const linkedTextures = linkTextures(source, world.textures, {
    textures: scene.textures,
    indexByName: new Map(scene.textures.map((texture, index) => [texture.name, index])),
  })
  const linkedMaterials = linkMaterials(source, world.materials, linkedTextures, {
    materials: scene.materials,
    // A later library's name shadows an earlier one's, as a lookup from the chain's head finds it first.
    indexByName: new Map(scene.materials.map((material, index) => [material.name, index])),
  })
  const counts = Object.freeze({
    worldPath,
    meshOffset: scene.meshes.length,
    materialAssignmentOffset: scene.materialAssignments.length,
    skeletonOffset: scene.skeletons.length,
    animationOffset: scene.animations.length,
    meshCount: world.meshes.length,
    materialAssignmentCount: world.materialAssignments.length,
    skeletonCount: world.skeletons.length,
    bspTreeCount: world.bspTrees.length,
  })
  const animations = Object.freeze([
    ...scene.animations,
    ...linkAnimations(source, world.animations),
  ])
  return Object.freeze({
    worldPaths: Object.freeze([...scene.worldPaths, worldPath]),
    textures: linkedTextures.textures,
    materials: linkedMaterials.materials,
    meshes: Object.freeze([...scene.meshes, ...linkMeshes(source, world.meshes, linkedMaterials)]),
    materialAssignments: Object.freeze([
      ...scene.materialAssignments,
      ...linkMaterialAssignments(source, world.materialAssignments, linkedMaterials),
    ]),
    skeletons: Object.freeze([...scene.skeletons, ...linkSkeletons(source, world.skeletons)]),
    animations,
    instances: Object.freeze([
      ...scene.instances,
      ...linkMeshInstances(world.meshInstances, counts),
      ...linkSkeletonInstances(world.skeletonInstances, counts, animations),
      ...linkBspTreeInstances(world.bspTreeInstances, counts),
    ]),
    cameras: Object.freeze([...scene.cameras, ...world.cameras.map(getSceneCamera)]),
    ambientLights: Object.freeze([
      ...scene.ambientLights,
      ...world.ambientLights.map(getSceneAmbientLight),
    ]),
    directionalLights: Object.freeze([
      ...scene.directionalLights,
      ...world.directionalLights.map(getSceneDirectionalLight),
    ]),
  })
}

// Loads worlds in order into one scene. A race loads several worlds into the same container (LEGORacers.exe
// 0x00432e20), whose texture and material chains (container +0x38 and +0x3c) every later world searches.
export const loadScene = (archive: JamArchive, worldPaths: readonly string[]): Scene =>
  worldPaths.reduce((scene, worldPath) => getSceneWithWorld(archive, scene, worldPath), EMPTY_SCENE)

// Every world file in the archive, in archive order.
export const getWorldPaths = (archive: JamArchive): readonly string[] =>
  Object.freeze(archive.getFilePaths().filter((path) => path.endsWith('.WDB')))

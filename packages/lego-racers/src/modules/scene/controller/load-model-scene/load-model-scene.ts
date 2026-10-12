import type { JamArchive } from '../../../jam-archive/index.ts'
import { parseModel } from '../../../model/index.ts'
import { SceneInstanceKind } from '../../types/scene-enums/scene-enums.ts'
import { getArchivePath } from '../../types/scene-path/scene-path.ts'
import type { Scene, SceneInstance } from '../../types/scene.types.ts'
import { linkMeshes } from '../load-scene/link-meshes.ts'
import { linkAnimations, linkSkeletons } from '../load-scene/link-skeletons.ts'
import { linkModelResources } from '../load-scene/link-model-resources.ts'
import type { ModelFiles, ModelScene } from './load-model-scene.types.ts'

const IDENTITY_ROTATION: SceneInstance['rotation'] = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1])
const ORIGIN = Object.freeze({ x: 0, y: 0, z: 0 })
// 0x10057330: the largest float, "always" for an instance level's distance.
const LARGEST_FLOAT = 3.4028234663852886e38

// Loads models that no world lists (a racer's car and driver, which the race's chassis and driver databases name)
// the way a world loads its files: textures, then materials, then models, all looked up in the same directory
// (GolDP.dll 0x10017ac0). Each model becomes a mesh instance at the origin so a renderer can place it itself; when
// the files name a skeleton and an animation the instances are skeleton instances following them.
export const loadModelScene = (
  archive: JamArchive,
  files: ModelFiles,
  earlier: Scene | null = null
): ModelScene => {
  const source = Object.freeze({ archive, directory: files.directory })
  const { textures, materials } = linkModelResources(
    source,
    files.textureNames,
    files.materialNames,
    earlier
  )
  const meshes = linkMeshes(source, files.meshNames, materials)
  const skeletons = files.skeletonName === null ? [] : linkSkeletons(source, [files.skeletonName])
  const animations =
    files.animationName === null ? [] : linkAnimations(source, [files.animationName])
  const isSkeletal = skeletons.length > 0 && animations.length > 0
  const instances: readonly SceneInstance[] = Object.freeze(
    meshes.map((mesh, meshIndex) =>
      Object.freeze({
        name: mesh.name,
        kind: isSkeletal ? SceneInstanceKind.SKELETON : SceneInstanceKind.MESH,
        worldPath: files.directory,
        startClipIndex: null,
        levels: Object.freeze([
          Object.freeze({
            meshIndex,
            skeletonIndex: isSkeletal ? 0 : null,
            animationIndex: isSkeletal ? 0 : null,
            materialAssignmentIndex: null,
            bspTreeIndex: null,
            squaredDistance: LARGEST_FLOAT,
          }),
        ]),
        position: ORIGIN,
        rotation: IDENTITY_ROTATION,
      })
    )
  )
  const scene: Scene = Object.freeze({
    worldPaths: Object.freeze([files.directory]),
    textures: textures.textures,
    materials: materials.materials,
    meshes,
    materialAssignments: Object.freeze([]),
    bspTrees: Object.freeze([]),
    skeletons: Object.freeze(skeletons),
    animations: Object.freeze(animations),
    instances,
    sprites: Object.freeze([]),
    cameras: Object.freeze([]),
    ambientLights: Object.freeze([]),
    directionalLights: Object.freeze([]),
  })
  return Object.freeze({
    scene,
    meshScales: Object.freeze(
      meshes.map((mesh) => parseModel(archive.readFile(getArchivePath('', mesh.path))).scale)
    ),
  })
}

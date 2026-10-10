import type { JamArchive } from '../../../jam-archive/index.ts'
import { parseModel } from '../../../model/index.ts'
import { SceneInstanceKind } from '../../types/scene-enums/scene-enums.ts'
import { getArchivePath } from '../../types/scene-path/scene-path.ts'
import type { Scene, SceneInstance } from '../../types/scene.types.ts'
import { linkMaterials } from '../load-scene/link-materials.ts'
import { linkMeshes } from '../load-scene/link-meshes.ts'
import { linkTextures } from '../load-scene/link-textures.ts'
import type { ModelFiles, ModelScene } from './load-model-scene.types.ts'

const IDENTITY_ROTATION: SceneInstance['rotation'] = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1])
const ORIGIN = Object.freeze({ x: 0, y: 0, z: 0 })
// 0x10057330: the largest float, "always" for an instance level's distance.
const LARGEST_FLOAT = 3.4028234663852886e38

// Loads models that no world lists (a racer's car and driver, which the race's chassis and driver databases name)
// the way a world loads its files: textures, then materials, then models, all looked up in the same directory
// (GolDP.dll 0x10017ac0). Each model becomes a mesh instance at the origin so a renderer can place it itself.
export const loadModelScene = (archive: JamArchive, files: ModelFiles): ModelScene => {
  const source = Object.freeze({ archive, directory: files.directory })
  const textures = linkTextures(source, files.textureNames, {
    textures: [],
    indexByName: new Map(),
  })
  const materials = linkMaterials(source, files.materialNames, textures, {
    materials: [],
    indexByName: new Map(),
  })
  const meshes = linkMeshes(source, files.meshNames, materials)
  const instances: readonly SceneInstance[] = Object.freeze(
    meshes.map((mesh, meshIndex) =>
      Object.freeze({
        name: mesh.name,
        kind: SceneInstanceKind.MESH,
        worldPath: files.directory,
        startClipIndex: null,
        levels: Object.freeze([
          Object.freeze({
            meshIndex,
            skeletonIndex: null,
            animationIndex: null,
            materialAssignmentIndex: null,
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
    skeletons: Object.freeze([]),
    animations: Object.freeze([]),
    instances,
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

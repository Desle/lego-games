import type { JamArchive } from '../../../jam-archive/index.ts'
import { SceneInstanceKind } from '../../types/scene-enums/scene-enums.ts'
import type { Scene, SceneInstance, SceneMaterial, SceneMesh } from '../../types/scene.types.ts'
import { linkAnimations, linkSkeletons } from '../load-scene/link-skeletons.ts'
import { linkModelResources } from '../load-scene/link-model-resources.ts'
import type { ModelScene } from '../load-model-scene/load-model-scene.types.ts'
import type { GeometryFiles, ModelGeometry } from './load-geometry-scene.types.ts'

const IDENTITY_ROTATION: SceneInstance['rotation'] = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1])
const ORIGIN = Object.freeze({ x: 0, y: 0, z: 0 })
// 0x10057330: the largest float, "always" for an instance level's distance.
const LARGEST_FLOAT = 3.4028234663852886e38
const MESH_NAME = 'built'
// The scale of a model that sets none (GolDP.dll 0x10027020).
const DEFAULT_MODEL_SCALE = 1

const getTintedMaterial = (
  material: SceneMaterial,
  tint: readonly [number, number, number, number]
): SceneMaterial => Object.freeze({ ...material, ambientColor: tint, diffuseColor: tint })

// The scene of a model made in memory (a car built from bricks, a driver made of parts) whose materials come from library
// files: one mesh instance at the origin, drawn with the library materials its batches name (a batch with a tint draws
// with a copy of its material with that colour); with `bones` the instance follows a skeleton and an animation.
export const loadGeometryScene = (
  archive: JamArchive,
  files: GeometryFiles,
  geometry: ModelGeometry,
  scale: number = DEFAULT_MODEL_SCALE
): ModelScene => {
  const source = Object.freeze({ archive, directory: files.directory })
  const { textures, materials } = linkModelResources(
    source,
    files.textureNames,
    files.materialNames,
    null
  )
  const sceneMaterials = [...materials.materials]
  const materialIndices = geometry.batches.map((batch) => {
    const material = materials.materials[batch.materialIndex]
    if (batch.tint === undefined || material === undefined) return batch.materialIndex
    sceneMaterials.push(getTintedMaterial(material, batch.tint))
    return sceneMaterials.length - 1
  })
  const boneSource =
    files.bones === null ? null : Object.freeze({ archive, directory: files.bones.directory })
  const skeletons =
    files.bones === null || boneSource === null
      ? []
      : linkSkeletons(boneSource, [files.bones.skeletonName])
  const animations =
    files.bones === null || boneSource === null
      ? []
      : linkAnimations(boneSource, [files.bones.animationName])
  const isSkeletal = skeletons.length > 0 && animations.length > 0
  const mesh: SceneMesh = Object.freeze({
    name: MESH_NAME,
    path: '',
    vertexCount: geometry.positions.length / 3,
    positions: geometry.positions,
    textureCoordinates: geometry.textureCoordinates,
    colors: null,
    normals: geometry.normals,
    materialIndices: Object.freeze(materialIndices),
    drawBatches: Object.freeze(
      geometry.batches.map((batch, materialSlot) =>
        Object.freeze({
          materialSlot,
          firstCommand: 0,
          vertexIndices: batch.vertexIndices,
          transformIndices: batch.transformIndices ?? new Uint8Array(batch.vertexIndices.length),
        })
      )
    ),
  })
  const instance: SceneInstance = Object.freeze({
    name: MESH_NAME,
    kind: isSkeletal ? SceneInstanceKind.SKELETON : SceneInstanceKind.MESH,
    worldPath: files.directory,
    startClipIndex: null,
    levels: Object.freeze([
      Object.freeze({
        meshIndex: 0,
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
  const scene: Scene = Object.freeze({
    worldPaths: Object.freeze([files.directory]),
    textures: textures.textures,
    materials: Object.freeze(sceneMaterials),
    meshes: Object.freeze([mesh]),
    materialAssignments: Object.freeze([]),
    bspTrees: Object.freeze([]),
    skeletons: Object.freeze(skeletons),
    animations: Object.freeze(animations),
    instances: Object.freeze([instance]),
    cameras: Object.freeze([]),
    ambientLights: files.ambientLights,
    directionalLights: files.directionalLights,
  })
  return Object.freeze({ scene, meshScales: Object.freeze([scale]) })
}

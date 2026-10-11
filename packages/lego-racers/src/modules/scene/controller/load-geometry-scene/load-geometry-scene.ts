import type { JamArchive } from '../../../jam-archive/index.ts'
import { SceneInstanceKind } from '../../types/scene-enums/scene-enums.ts'
import type { Scene, SceneInstance, SceneMesh } from '../../types/scene.types.ts'
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

// The scene of a model made in memory (a car built from bricks) whose materials come from library files: one mesh
// instance at the origin, drawn with the library materials its batches name.
export const loadGeometryScene = (
  archive: JamArchive,
  files: GeometryFiles,
  geometry: ModelGeometry
): ModelScene => {
  const source = Object.freeze({ archive, directory: files.directory })
  const { textures, materials } = linkModelResources(
    source,
    files.textureNames,
    files.materialNames
  )
  const mesh: SceneMesh = Object.freeze({
    name: MESH_NAME,
    path: '',
    vertexCount: geometry.positions.length / 3,
    positions: geometry.positions,
    textureCoordinates: geometry.textureCoordinates,
    colors: null,
    normals: geometry.normals,
    materialIndices: Object.freeze(geometry.batches.map((batch) => batch.materialIndex)),
    drawBatches: Object.freeze(
      geometry.batches.map((batch, materialSlot) =>
        Object.freeze({
          materialSlot,
          vertexIndices: batch.vertexIndices,
          transformIndices: new Uint8Array(batch.vertexIndices.length),
        })
      )
    ),
  })
  const instance: SceneInstance = Object.freeze({
    name: MESH_NAME,
    kind: SceneInstanceKind.MESH,
    worldPath: files.directory,
    startClipIndex: null,
    levels: Object.freeze([
      Object.freeze({
        meshIndex: 0,
        skeletonIndex: null,
        animationIndex: null,
        materialAssignmentIndex: null,
        squaredDistance: LARGEST_FLOAT,
      }),
    ]),
    position: ORIGIN,
    rotation: IDENTITY_ROTATION,
  })
  const scene: Scene = Object.freeze({
    worldPaths: Object.freeze([files.directory]),
    textures: textures.textures,
    materials: materials.materials,
    meshes: Object.freeze([mesh]),
    materialAssignments: Object.freeze([]),
    skeletons: Object.freeze([]),
    animations: Object.freeze([]),
    instances: Object.freeze([instance]),
    cameras: Object.freeze([]),
    ambientLights: files.ambientLights,
    directionalLights: files.directionalLights,
  })
  return Object.freeze({ scene, meshScales: Object.freeze([DEFAULT_MODEL_SCALE]) })
}

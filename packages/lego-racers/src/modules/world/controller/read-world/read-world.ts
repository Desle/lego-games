import { BinaryToken } from '../../types/binary-token/binary-token.ts'
import { TokenReaderFailure } from '../../types/token-reader-failure/token-reader-failure.ts'
import { createTokenReader } from '../../types/token-reader/token-reader.ts'
import type { TokenReader } from '../../types/token-reader/token-reader.types.ts'
import { WorldKeyword } from '../../types/world-keyword/world-keyword.ts'
import type {
  AmbientLight,
  BspTreeInstance,
  BspVolumeInstance,
  Camera,
  DirectionalLight,
  MeshInstance,
  SkeletonInstance,
  Sprite,
  World,
} from '../../types/world.types.ts'
import {
  readAmbientLights,
  readBspTreeInstances,
  readBspVolumeInstances,
  readCameras,
  readDirectionalLights,
  readMeshInstances,
  readNameList,
  readSkeletonInstances,
  readSprites,
} from './read-world-entries.ts'
import type { WorldCounts } from './read-world.types.ts'

const EMPTY: readonly never[] = Object.freeze([])

// 0x1002c240: one pass over the top-level keywords; unknown tokens are skipped silently.
export const readWorldFromReader = (reader: TokenReader): World => {
  let textures: readonly string[] | null = null
  let materials: readonly string[] | null = null
  let animations: readonly string[] | null = null
  let meshes: readonly string[] | null = null
  let materialAssignments: readonly string[] | null = null
  let skeletons: readonly string[] | null = null
  let bspTrees: readonly string[] | null = null
  let materialAnimations: readonly string[] | null = null
  let bspVolumes: readonly string[] | null = null
  let meshInstances: readonly MeshInstance[] | null = null
  let skeletonInstances: readonly SkeletonInstance[] | null = null
  let bspTreeInstances: readonly BspTreeInstance[] | null = null
  let bspVolumeInstances: readonly BspVolumeInstance[] | null = null
  let sprites: readonly Sprite[] | null = null
  let cameras: readonly Camera[] | null = null
  let ambientLights: readonly AmbientLight[] | null = null
  let directionalLights: readonly DirectionalLight[] | null = null

  const getCounts = (): WorldCounts =>
    Object.freeze({
      animations: animations?.length ?? 0,
      meshes: meshes?.length ?? 0,
      materialAssignments: materialAssignments?.length ?? 0,
      skeletons: skeletons?.length ?? 0,
      bspTrees: bspTrees?.length ?? 0,
      bspVolumes: bspVolumes?.length ?? 0,
      skeletonInstances: skeletonInstances?.length ?? 0,
    })

  const readOnce = <Section>(current: Section | null, readSection: () => Section): Section => {
    if (current !== null) reader.fail(TokenReaderFailure.UNEXPECTED_KEYWORD)
    return readSection()
  }

  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.END_OF_FILE;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case WorldKeyword.TEXTURE:
        textures = readOnce(textures, () => readNameList(reader))
        break
      case WorldKeyword.MATERIAL:
        materials = readOnce(materials, () => readNameList(reader))
        break
      case WorldKeyword.ANIMATION:
        animations = readOnce(animations, () => readNameList(reader))
        break
      case WorldKeyword.MESH:
        meshes = readOnce(meshes, () => readNameList(reader))
        break
      case WorldKeyword.MATERIAL_ASSIGNMENT:
        materialAssignments = readOnce(materialAssignments, () => readNameList(reader))
        break
      case WorldKeyword.SKELETON:
        skeletons = readOnce(skeletons, () => readNameList(reader))
        break
      case WorldKeyword.BSP_TREE:
        bspTrees = readOnce(bspTrees, () => readNameList(reader))
        break
      case WorldKeyword.MESH_INSTANCE:
        meshInstances = readOnce(meshInstances, () => readMeshInstances(reader, getCounts()))
        break
      case WorldKeyword.SKELETON_INSTANCE:
        skeletonInstances = readOnce(skeletonInstances, () =>
          readSkeletonInstances(reader, getCounts())
        )
        break
      case WorldKeyword.BSP_TREE_INSTANCE:
        bspTreeInstances = readOnce(bspTreeInstances, () =>
          readBspTreeInstances(reader, getCounts())
        )
        break
      case WorldKeyword.SPRITE:
        sprites = readOnce(sprites, () => readSprites(reader))
        break
      case WorldKeyword.MATERIAL_ANIMATION:
        materialAnimations = readOnce(materialAnimations, () => readNameList(reader))
        break
      case WorldKeyword.BSP_VOLUME:
        bspVolumes = readOnce(bspVolumes, () => readNameList(reader))
        break
      case WorldKeyword.BSP_VOLUME_INSTANCE:
        bspVolumeInstances = readOnce(bspVolumeInstances, () =>
          readBspVolumeInstances(reader, getCounts())
        )
        break
      case WorldKeyword.CAMERA:
        cameras = readOnce(cameras, () => readCameras(reader, getCounts()))
        break
      case WorldKeyword.AMBIENT_LIGHT:
        ambientLights = readOnce(ambientLights, () => readAmbientLights(reader))
        break
      case WorldKeyword.DIRECTIONAL_LIGHT:
        directionalLights = readOnce(directionalLights, () => readDirectionalLights(reader))
        break
      default:
        break
    }
  }

  return Object.freeze({
    textures: textures ?? EMPTY,
    materials: materials ?? EMPTY,
    animations: animations ?? EMPTY,
    meshes: meshes ?? EMPTY,
    materialAssignments: materialAssignments ?? EMPTY,
    skeletons: skeletons ?? EMPTY,
    bspTrees: bspTrees ?? EMPTY,
    materialAnimations: materialAnimations ?? EMPTY,
    bspVolumes: bspVolumes ?? EMPTY,
    meshInstances: meshInstances ?? EMPTY,
    skeletonInstances: skeletonInstances ?? EMPTY,
    bspTreeInstances: bspTreeInstances ?? EMPTY,
    bspVolumeInstances: bspVolumeInstances ?? EMPTY,
    sprites: sprites ?? EMPTY,
    cameras: cameras ?? EMPTY,
    ambientLights: ambientLights ?? EMPTY,
    directionalLights: directionalLights ?? EMPTY,
  })
}

export const readWorld = (bytes: Uint8Array): World => readWorldFromReader(createTokenReader(bytes))
